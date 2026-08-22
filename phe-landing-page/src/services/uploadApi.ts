/**
 * Client for the audio-upload-api three-step flow:
 *   1. POST /uploads/initiate  -> presigned R2 PUT URL + recordingId
 *   2. PUT bytes directly to R2 (never through the Worker)
 *   3. POST /uploads/:id/complete -> confirms the object, advances lifecycle
 */
import { API_BASE_URL } from "../config";
import { supabase } from "../lib/supabaseClient";

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
};

const ALLOWED_BROWSER_TYPES = new Set([
  "audio/wav", "audio/x-wav", "audio/wave",
  "audio/mpeg", "audio/mp3",
  "audio/aiff", "audio/x-aiff",
  "audio/flac", "audio/x-flac",
  "audio/ogg", "application/ogg", "audio/vorbis",
]);

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
  if (!supabase) return null;
  try {
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
        : reject(new UploadError(`Storage upload failed (${xhr.status}).`, xhr.status));
    xhr.onerror = () => reject(new UploadError("Network error during upload."));
    xhr.onabort = () => reject(new UploadError("Upload was interrupted."));
    xhr.send(file);
  });
}

async function complete(recordingId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/uploads/${recordingId}/complete`, { method: "POST" });
  } catch {
    throw new UploadError("Uploaded, but couldn't confirm with the server. Please try again.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new UploadError(messageFrom(data, "Could not finalize the upload."), res.status);
  }
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
