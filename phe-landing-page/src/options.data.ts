// Source of truth for the upload form's controlled vocabularies. The API keeps a
// vendored copy (audio-upload-api/src/data/options.ts); keep the two identical
// below this header (`npm run check:vocab` in audio-upload-api enforces it).
// The vocabulary itself lives in vocab.generated.json, built from the
// hazzat.com catalogue by audio-upload-api/scripts/import_hazzat.py; edit
// audio-upload-api/data/hazzat/, never the JSON.
import generated from "./vocab.generated.json";

export type SelectOption = {
  value: string;
  label: string;
  /** Arabic name, when known; searchable but not shown. */
  labelAr?: string | null;
};

export type VocabHymn = {
  slug: string;
  label: string;
  labelAr: string | null;
  hazzatId: string | null;
  sourceUrl: string | null;
  rhythm: string | null;
  active: boolean;
  types: string[];
  tunes: string[];
};

export type GeneratedVocab = {
  seasons: { slug: string; label: string; labelAr: string | null; sortOrder: number }[];
  services: { slug: string; label: string; sortOrder: number }[];
  languages: { slug: string; label: string }[];
  hymnTypes: { slug: string; label: string }[];
  tunes: { slug: string; label: string }[];
  hymns: VocabHymn[];
  /** [hymn slug, season slug, service slug, position in that service] */
  placements: [string, string, string, number][];
};

export const vocab = generated as unknown as GeneratedVocab;

const toOption = (r: { slug: string; label: string; labelAr?: string | null }): SelectOption => ({
  value: r.slug,
  label: r.label,
  ...(r.labelAr ? { labelAr: r.labelAr } : {}),
});
const byLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label);

const seasonOrder = new Map(vocab.seasons.map((s) => [s.slug, s.sortOrder]));
const serviceOrder = new Map(vocab.services.map((s) => [s.slug, s.sortOrder]));
const seasonLabel = new Map(vocab.seasons.map((s) => [s.slug, s.label]));
const serviceLabel = new Map(vocab.services.map((s) => [s.slug, s.label]));
const activeHymns = vocab.hymns.filter((h) => h.active);

/**
 * Where each hymn is first said (earliest season, then service), to tell
 * apart hymns that share a name in the full list.
 */
const firstPlace = new Map<string, { season: string; service: string }>();
for (const [hymn, season, service] of vocab.placements) {
  const cur = firstPlace.get(hymn);
  const earlier =
    !cur ||
    seasonOrder.get(season)! < seasonOrder.get(cur.season)! ||
    (season === cur.season && serviceOrder.get(service)! < serviceOrder.get(cur.service)!);
  if (earlier) firstPlace.set(hymn, { season, service });
}

/**
 * Names for the full list, where many hymns share a name (each season has its
 * own "Gospel Response"). A shared name gains the season it's first said in,
 * then the service too if that still isn't unique: "Gospel Response — Nativity".
 */
function fullListLabels(): Map<string, string> {
  const count = (labels: Iterable<string>) => {
    const c = new Map<string, number>();
    for (const l of labels) c.set(l, (c.get(l) ?? 0) + 1);
    return c;
  };
  const byName = count(activeHymns.map((h) => h.label));
  const withSeason = new Map(
    activeHymns.map((h) => {
      const place = firstPlace.get(h.slug);
      return [h.slug, byName.get(h.label)! > 1 && place ? `${h.label} — ${seasonLabel.get(place.season)}` : h.label];
    }),
  );
  const seasonCount = count(withSeason.values());
  return new Map(
    activeHymns.map((h) => {
      const label = withSeason.get(h.slug)!;
      const place = firstPlace.get(h.slug);
      return [h.slug, seasonCount.get(label)! > 1 && place ? `${label} · ${serviceLabel.get(place.service)}` : label];
    }),
  );
}
const FULL_LABELS = fullListLabels();

/** Every hymn a contributor may pick (retired ones are hidden), with full-list names. */
export const hymn_options: SelectOption[] = activeHymns
  .map((h) => ({ ...toOption(h), label: FULL_LABELS.get(h.slug)! }))
  .sort(byLabel);
export const language_options: SelectOption[] = vocab.languages.map(toOption);
export const service_options: SelectOption[] = [...vocab.services]
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map(toOption);
export const season_options: SelectOption[] = [...vocab.seasons]
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map(toOption);

/** Lowercased, with Arabic diacritics and letter variants folded, for search. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

/** Search match on the English name, the slug, or the Arabic name. */
export function matchesOption(option: SelectOption, input: string): boolean {
  const q = fold(input);
  if (!q) return true;
  return [option.label, option.value, option.labelAr ?? ""].some((t) => fold(t).includes(q));
}

/**
 * A season or service of "other"/"unknown" means the contributor can't place
 * the hymn, so any hymn is allowed.
 */
export const ESCAPE_SLUGS: ReadonlySet<string> = new Set(["other", "unknown"]);

const pairKey = (season: string, service: string) => `${season}|${service}`;

/** season|service -> hymn slugs said there. */
export const hymnsByPair: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const pairs = new Map<string, Set<string>>();
  for (const [hymn, season, service] of vocab.placements) {
    const key = pairKey(season, service);
    if (!pairs.has(key)) pairs.set(key, new Set());
    pairs.get(key)!.add(hymn);
  }
  return pairs;
})();

/**
 * The hymns that belong to a season + service. Falls back to every hymn when
 * either is an escape value or the pair has no linked hymns yet (e.g. Unction),
 * so the form is never left with an empty list. The API applies the same rule
 * (src/lib/placement.ts).
 */
export function hymnSlugsFor(season: string, service: string): ReadonlySet<string> | null {
  if (ESCAPE_SLUGS.has(season) || ESCAPE_SLUGS.has(service)) return null;
  return hymnsByPair.get(pairKey(season, service)) ?? null;
}

/**
 * Hymn dropdown options for a season + service, alphabetical. `all` asks for
 * the whole catalogue even when the pair has a list ("my hymn isn't listed").
 * `filtered` is true when only the pair's own list is shown. Names in a pair's
 * list are already unique; the full list uses the disambiguated names.
 */
export function hymnsFor(
  season: string,
  service: string,
  { all = false }: { all?: boolean } = {},
): { options: SelectOption[]; count: number; filtered: boolean } {
  const allowed = all ? null : hymnSlugsFor(season, service);
  const options = allowed
    ? activeHymns.filter((h) => allowed.has(h.slug)).map(toOption).sort(byLabel)
    : hymn_options;
  return { options, count: options.length, filtered: allowed !== null };
}
