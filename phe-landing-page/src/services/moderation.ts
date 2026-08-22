/**
 * Client for the Worker's moderation endpoints.
 *
 * Unlike the contributor dashboard — which reads its own rows straight from
 * Supabase under RLS — every call here goes through the Worker. RLS scopes a
 * user to their *own* recordings by design, which is the opposite of what a
 * moderator needs, so the queue runs on the Worker's service_role behind an
 * admin check (ADR-010).
 */
import { API_BASE_URL } from "../config";
import { supabase } from "../lib/supabaseClient";

export interface QueueItem {
  id: string;
  title: string;
  service: string | null;
  season: string | null;
  languages: string[];
  durationSeconds: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  codec: string | null;
  contentType: string;
  fileSizeBytes: number | null;
  originalFilename: string | null;
  uploadedAt: string;
  contributor: string | null;
  /** False until the offline ffprobe job has run — there is less to judge on. */
  isEnriched: boolean;
}

export interface QueuePage {
  items: QueueItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface PlaybackSource {
  url: string;
  contentType: string;
  expiresInSeconds: number;
}

/** An error carrying the HTTP status, so the UI can tell "gone" from "broken". */
export class ModerationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ModerationError";
    this.status = status;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new ModerationError("Sign-in is not configured.", 401);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ModerationError("Your session has expired. Sign in again.", 401);
  return { Authorization: `Bearer ${token}` };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

/**
 * Whether the signed-in user may moderate. Returns false rather than throwing:
 * this decides whether to *offer* the queue, and a network hiccup should hide
 * the link, not break the page.
 *
 * Takes the token explicitly instead of calling `supabase.auth.getSession()`.
 * This runs right as the session is established, while supabase-js still holds
 * its auth lock for the INITIAL_SESSION callback — asking it for the session
 * there deadlocks, and the promise never settles.
 */
export async function fetchIsAdmin(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { isAdmin?: boolean };
    return Boolean(body.isAdmin);
  } catch {
    return false;
  }
}

export async function fetchQueue(limit = 25, offset = 0): Promise<QueuePage> {
  const res = await fetch(`${API_BASE_URL}/admin/queue?limit=${limit}&offset=${offset}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new ModerationError(await readError(res, "Could not load the review queue."), res.status);
  }
  return (await res.json()) as QueuePage;
}

/**
 * A short-lived presigned R2 URL. Fetched per recording rather than with the
 * queue so the URLs aren't already expiring by the time they're clicked.
 */
export async function fetchPlaybackSource(id: string): Promise<PlaybackSource> {
  const res = await fetch(`${API_BASE_URL}/admin/recordings/${id}/audio`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new ModerationError(await readError(res, "Could not load the audio."), res.status);
  }
  return (await res.json()) as PlaybackSource;
}

export interface ReviewResult {
  id: string;
  reviewStatus: "ready" | "rejected";
  reviewedAt: string;
}

export async function submitReview(
  id: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<ReviewResult> {
  const res = await fetch(`${API_BASE_URL}/admin/recordings/${id}/review`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ decision, reason }),
  });
  if (!res.ok) {
    // 409 means somebody already decided it — the caller drops the card rather
    // than showing a failure, since the queue was simply out of date.
    throw new ModerationError(await readError(res, "Could not record your decision."), res.status);
  }
  return (await res.json()) as ReviewResult;
}

/**
 * Rejection reasons offered in the UI. A controlled vocabulary keeps the audit
 * trail analyzable later — 200 unique sentences tell you nothing in aggregate —
 * while "Something else" preserves the escape hatch.
 */
export const REJECTION_REASONS = [
  "Audio quality too poor to use",
  "Not the hymn it is labeled as",
  "Not a liturgical recording",
  "Excessive background noise or talking",
  "Incomplete or cut off",
  "Duplicate of an existing recording",
] as const;
