import type { Vocab } from './vocab';

/**
 * A season or service of "other"/"unknown" means the contributor can't place
 * the hymn, so any hymn is allowed. Mirrors ESCAPE_SLUGS in src/data/options.ts
 * (the form's copy); kept separate so the Worker doesn't bundle the whole
 * vocabulary JSON. scripts/check-placement.ts asserts the two agree.
 */
export const ESCAPE_SLUGS: ReadonlySet<string> = new Set(['other', 'unknown']);

export type PlacementResult =
  | { ok: true }
  | { ok: false; reason: 'retired' | 'not_in_season_service' };

/**
 * Is this hymn said in this season + service? Slugs are assumed to exist
 * already (the route checks that first).
 *
 * Allowed when the season or service is an escape value, when the pair has no
 * linked hymns yet (nothing to check against, e.g. Unction), or when the
 * placement exists. A retired hymn is always refused.
 */
export function checkPlacement(
  vocab: Pick<Vocab, 'retiredHymns' | 'hymnsByPair'>,
  season: string,
  service: string,
  hymn: string,
): PlacementResult {
  if (vocab.retiredHymns.has(hymn)) return { ok: false, reason: 'retired' };
  if (ESCAPE_SLUGS.has(season) || ESCAPE_SLUGS.has(service)) return { ok: true };
  const allowed = vocab.hymnsByPair.get(`${season}|${service}`);
  if (!allowed || allowed.has(hymn)) return { ok: true };
  return { ok: false, reason: 'not_in_season_service' };
}
