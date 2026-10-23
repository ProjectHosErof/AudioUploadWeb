// ⚠️ VENDORED COPY of phe-landing-page/src/options.data.ts — keep the two
// identical below this header (`npm run check:vocab` enforces it).
// The vocabulary itself lives in vocab.generated.json, built from the
// hazzat.com catalogue by scripts/import_hazzat.py; edit data/hazzat/, never
// the JSON. The seed loads it into the DB reference tables so frontend
// dropdowns and backend validation share one vocabulary.

import generated from "./vocab.generated.json";

export type SelectOption = {
  value: string;
  label: string;
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

const toOption = (r: { slug: string; label: string }): SelectOption => ({ value: r.slug, label: r.label });
const byLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label);

/** Every hymn a contributor may pick (retired ones are hidden). */
export const hymn_options: SelectOption[] = vocab.hymns.filter((h) => h.active).map(toOption).sort(byLabel);
export const language_options: SelectOption[] = vocab.languages.map(toOption);
export const service_options: SelectOption[] = [...vocab.services]
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map(toOption);
export const season_options: SelectOption[] = [...vocab.seasons]
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map(toOption);

/**
 * A season or service of "other"/"unknown" means the contributor can't place
 * the hymn, so any hymn is allowed.
 */
export const ESCAPE_SLUGS: ReadonlySet<string> = new Set(["other", "unknown"]);

const pairKey = (season: string, service: string) => `${season}|${service}`;

/** season|service -> hymn slug -> its position in that service. */
const orderByPair = new Map<string, Map<string, number>>();
for (const [hymn, season, service, order] of vocab.placements) {
  const key = pairKey(season, service);
  if (!orderByPair.has(key)) orderByPair.set(key, new Map());
  orderByPair.get(key)!.set(hymn, order);
}

/** season|service -> hymn slugs said there. */
export const hymnsByPair: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  [...orderByPair].map(([key, hymns]) => [key, new Set(hymns.keys())]),
);

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

export type HymnGroup = { label: string; options: SelectOption[] };

const typeLabel = new Map(vocab.hymnTypes.map((t) => [t.slug, t.label]));
const activeHymns = vocab.hymns.filter((h) => h.active);
const OTHER_GROUP = "Other hymns";

/**
 * Hymn dropdown options for a season + service, grouped by hymn type
 * (Doxology, Psalm Response, …). Groups and the hymns in them follow the order
 * the hymns come in the service. `filtered` is false when the fallback to the
 * full list applied.
 */
export function hymnsFor(
  season: string,
  service: string,
): { groups: HymnGroup[]; count: number; filtered: boolean } {
  const allowed = hymnSlugsFor(season, service);
  const order = allowed ? orderByPair.get(pairKey(season, service))! : null;
  // In service order when there is a list, alphabetical when there isn't.
  const hymns = order
    ? activeHymns.filter((h) => order.has(h.slug)).sort((a, b) => order.get(a.slug)! - order.get(b.slug)!)
    : [...activeHymns].sort((a, b) => a.label.localeCompare(b.label));
  const groups = new Map<string, SelectOption[]>();
  for (const h of hymns) {
    const group = (h.types[0] && typeLabel.get(h.types[0])) || OTHER_GROUP;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(toOption(h));
  }
  // Each group appears where its first hymn does; hymns without a type go last.
  const ordered = [...groups.entries()]
    .sort(([a], [b]) =>
      order ? Number(a === OTHER_GROUP) - Number(b === OTHER_GROUP)
            : a === OTHER_GROUP ? 1 : b === OTHER_GROUP ? -1 : a.localeCompare(b))
    .map(([label, options]) => ({ label, options }));
  return { groups: ordered, count: ordered.reduce((n, g) => n + g.options.length, 0), filtered: allowed !== null };
}
