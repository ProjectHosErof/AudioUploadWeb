/**
 * Client for the audio-upload-api three-step flow:
 *   1. POST /uploads/initiate  -> presigned R2 PUT URL + recordingId
 *   2. PUT bytes directly to R2 (never through the Worker)
 *   3. POST /uploads/:id/complete -> confirms the object, advances lifecycle
 */
import { API_BASE_URL } from "../config";
import { getSupabase, hasStoredSessionOrAuthRedirect } from "../lib/supabaseClient";

export interface InitiateRequest {
  service_slug: string;
  season_slug: string;
  hymn_slug: string;
  languages: string[];
  content_type: string;
  size_bytes: number;
  original_filename?: string;
  wants_updates: boolean;
  email?: string;
  turnstile_token: string;
  /** Version of the Terms the contributor agreed to (src/legal/terms.ts). */
  accepted_terms_version: string;
}

interface InitiateResponse {
  recordingId: string;
  r2Key: string;
  uploadUrl: string;
  method: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}

/** An error carrying the HTTP status so the UI can tailor its message. */
export class UploadError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

// Canonical extension -> MIME type. Every value is in the Worker's allowlist.
const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  flac: "audio/flac",
  ogg: "audio/ogg",
  // Phone recorders (iPhone Voice Memos, most Android apps).
  m4a: "audio/mp4",
  aac: "audio/aac",
  // WhatsApp voice notes and browser recorders.
  webm: "audio/webm",
  opus: "audio/opus",
};

const ALLOWED_BROWSER_TYPES = new Set([
  "audio/wav", "audio/x-wav", "audio/wave",
  "audio/mpeg", "audio/mp3",
  "audio/aiff", "audio/x-aiff",
  "audio/flac", "audio/x-flac",
  "audio/ogg", "application/ogg", "audio/vorbis",
  "audio/mp4", "audio/x-m4a", "audio/m4a",
  "audio/aac", "audio/x-aac",
  "audio/webm", "audio/opus",
]);

/** For the file input's `accept`: every extension and MIME type above. */
export const ACCEPTED_AUDIO = [
  ...Object.keys(EXT_TO_CONTENT_TYPE).map((ext) => `.${ext}`),
  ...ALLOWED_BROWSER_TYPES,
].join(",");

/** Matches the Worker's MAX_UPLOAD_BYTES (wrangler.jsonc): 200 MB. Checked
 *  as soon as a file is chosen; the Worker enforces it either way. */
export const MAX_UPLOAD_BYTES = 209_715_200;

/** Human-readable list for labels and error messages. */
export const ACCEPTED_AUDIO_LABEL = "M4A, MP3, WAV, FLAC, AIFF, OGG or WebM";

/**
 * Resolve a content-type the Worker will accept. Prefer the file extension
 * (deterministic), falling back to a browser-provided type if it's allowlisted.
 * Returns null for unsupported files so the caller can reject before uploading.
 */
export function resolveContentType(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext in EXT_TO_CONTENT_TYPE) return EXT_TO_CONTENT_TYPE[ext];
  if (file.type && ALLOWED_BROWSER_TYPES.has(file.type)) return file.type;
  return null;
}

function messageFrom(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string" && err) return err;
  }
  return fallback;
}

/**
 * Current access token, or null when signed out. Uploads stay anonymous
 * (ADR-004) — this only lets the Worker attribute the submission to a
 * contributor when one happens to be signed in.
 */
async function currentAccessToken(): Promise<string | null> {
  // No saved session means signed out; don't load the auth library to learn that.
  if (!hasStoredSessionOrAuthRedirect()) return null;
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function initiate(req: InitiateRequest): Promise<InitiateResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await currentAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/uploads/initiate`, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
    });
  } catch {
    throw new UploadError("Couldn't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403) {
      throw new UploadError("Verification failed. Please complete the challenge and retry.", 403);
    }
    if (res.status === 413) {
      throw new UploadError("That file is too large.", 413);
    }
    if (res.status === 429) {
      throw new UploadError(
        "You've sent several recordings in a short time — please wait a minute, then try again.",
        429,
      );
    }
    if (res.status >= 500) {
      throw new UploadError(
        "Something went wrong on our side and your recording wasn't sent. Please try again in a moment.",
        res.status,
      );
    }
    const fields = (data as { fields?: unknown }).fields;
    if (res.status === 400 && Array.isArray(fields) && fields.includes("hymn_slug")) {
      throw new UploadError(
        "That hymn isn't listed for the season and service you chose — please pick it again from the list.",
        400,
      );
    }
    throw new UploadError(messageFrom(data, "Could not start the upload."), res.status);
  }
  return data as InitiateResponse;
}

/** PUT the file straight to R2, reporting progress via XHR. */
function putToStorage(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new UploadError("Your file didn't finish uploading. Please try again.", xhr.status));
    xhr.onerror = () =>
      reject(new UploadError("The connection dropped while uploading. Please check your connection and try again."));
    xhr.onabort = () => reject(new UploadError("Upload was interrupted."));
    xhr.send(file);
  });
}

/**
 * Confirm the upload with the Worker. By now the file is safely in storage, so
 * a hiccup here shouldn't send the contributor back to upload it all again:
 * retry a few times with backoff. Safe because /complete is idempotent.
 * A 409 ("not in storage yet") is also worth retrying — storage can lag a
 * moment behind the PUT.
 */
async function complete(recordingId: string): Promise<void> {
  const delays = [0, 1000, 3000, 7000];
  let lastError: UploadError | null = null;
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/uploads/${recordingId}/complete`, { method: "POST" });
    } catch {
      lastError = new UploadError("Uploaded, but couldn't confirm with the server.");
      continue;
    }
    if (res.ok) return;
    const data = await res.json().catch(() => ({}));
    lastError = new UploadError(messageFrom(data, "Could not finalize the upload."), res.status);
    // Only transient failures are worth another try.
    if (res.status !== 409 && res.status < 500) break;
  }
  throw lastError ?? new UploadError("Could not finalize the upload.");
}

/**
 * Run the full initiate -> PUT -> complete flow. Returns the recordingId.
 * `onProgress` reports 0-100 during the R2 upload.
 */
export async function uploadRecording(
  params: Omit<InitiateRequest, "content_type"> & { file: File; content_type: string },
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { file, ...rest } = params;
  const init = await initiate(rest);
  const contentType = init.requiredHeaders?.["Content-Type"] ?? params.content_type;
  await putToStorage(init.uploadUrl, file, contentType, onProgress);
  await complete(init.recordingId);
  return init.recordingId;
}
