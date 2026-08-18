import { API_BASE_URL } from "../config";
import { supabase } from "../lib/supabaseClient";

/**
 * Contributor-facing reads.
 *
 * A signed-in contributor's own recordings come straight from Supabase under
 * Row-Level Security (ADR-003) — the policy scopes rows to the caller, so no
 * bespoke endpoint is involved. Corpus-wide totals can't work that way (RLS
 * hides everyone else's rows), so those come from the Worker (ADR-006).
 */

export type ReviewStatus = "processing" | "ready" | "rejected";

export interface MyRecording {
  id: string;
  title: string;
  service: string;
  season: string;
  languages: string;
  durationSeconds: number | null;
  uploadedAt: string;
  status: ReviewStatus;
  /** Set when a rejection was an exact-duplicate rather than a moderation call. */
  isDuplicate: boolean;
}

export interface CommunityStats {
  readyRecordings: number;
  totalRecordings: number;
  readySeconds: number;
  contributors: number;
}

/** How a status is shown to a contributor — never the raw lifecycle word (ADR-005). */
export interface StatusPresentation {
  label: string;
  tone: "accepted" | "pending" | "declined" | "duplicate";
}

export function describeStatus(r: MyRecording): StatusPresentation {
  if (r.status === "ready") return { label: "In the collection", tone: "accepted" };
  if (r.status === "processing") return { label: "Under review", tone: "pending" };
  return r.isDuplicate
    ? { label: "Already collected", tone: "duplicate" }
    : { label: "Not added", tone: "declined" };
}

// Shape returned by the query below (labels arrive via FK-embedded resources).
interface RecordingRow {
  id: string;
  hymn_label: string;
  languages: string[] | null;
  duration_seconds: string | number | null;
  created_at: string;
  review_status: ReviewStatus;
  error_message: string | null;
  services: { label: string } | null;
  seasons: { label: string } | null;
}

/** Cached for the page's lifetime — the vocabulary is tiny and effectively static. */
let languageLabels: Map<string, string> | null = null;

async function getLanguageLabels(): Promise<Map<string, string>> {
  if (languageLabels) return languageLabels;
  if (!supabase) return new Map();
  const { data, error } = await supabase.from("languages").select("slug, label");
  if (error) {
    console.error("language lookup failed", error);
    return new Map();
  }
  languageLabels = new Map((data ?? []).map((l) => [l.slug as string, l.label as string]));
  return languageLabels;
}

/**
 * The signed-in contributor's own recordings, newest first. RLS does the
 * filtering, so this returns nothing at all when signed out.
 */
export async function fetchMyRecordings(): Promise<MyRecording[]> {
  if (!supabase) return [];

  const [{ data, error }, labels] = await Promise.all([
    supabase
      .from("recordings")
      .select(
        "id, hymn_label, languages, duration_seconds, created_at, review_status, error_message, services(label), seasons(label)",
      )
      .order("created_at", { ascending: false }),
    getLanguageLabels(),
  ]);

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RecordingRow[]).map((row) => ({
    id: row.id,
    title: row.hymn_label,
    service: row.services?.label ?? "—",
    season: row.seasons?.label ?? "—",
    languages:
      (row.languages ?? []).map((slug) => labels.get(slug) ?? slug).join(" / ") || "—",
    // numeric columns come back as strings from PostgREST.
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    uploadedAt: row.created_at,
    status: row.review_status,
    isDuplicate: (row.error_message ?? "").toLowerCase().includes("duplicate"),
  }));
}

/** Corpus-wide totals (Worker aggregate; see ADR-006). */
export async function fetchCommunityStats(): Promise<CommunityStats | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/stats/community`);
    if (!res.ok) return null;
    return (await res.json()) as CommunityStats;
  } catch {
    // Motivational only — never let this break the dashboard.
    return null;
  }
}
