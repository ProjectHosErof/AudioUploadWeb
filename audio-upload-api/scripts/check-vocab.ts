/**
 * Sanity-check the controlled vocabulary (src/data/vocab.generated.json, via
 * src/data/options.ts) that seeds the reference tables and is validated on
 * every upload.
 *
 * FAILS (exit 1) on:
 *  - empty or duplicate slugs, which silently break validation or seeding;
 *  - the form's copy of the vocabulary drifting from the API's;
 *  - a placement or type/tune link pointing at an unknown slug;
 *  - an active hymn with no season + service to be picked from;
 *  - two active hymns with the same label in one season + service dropdown;
 *  - mappings.json crosswalk/retired entries naming unknown slugs.
 * WARNS on non-URL-safe slugs (e.g. "End of Service Hymn"): allowed today but
 * flagged as debt to normalize in a coordinated pass.
 *
 * Usage: npm run check:vocab
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  hymn_options,
  language_options,
  service_options,
  season_options,
  vocab,
  type SelectOption,
} from '../src/data/options';

const SLUG_RE = /^[a-z0-9-]+$/;
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

let failures = 0;
let warnings = 0;
const fail = (msg: string) => {
  console.error(`FAIL ${msg}`);
  failures++;
};

function check(name: string, options: readonly SelectOption[]): void {
  const seen = new Map<string, number>();
  for (const [i, o] of options.entries()) {
    const value = o.value?.trim() ?? '';
    const label = o.label?.trim() ?? '';
    if (!value) {
      fail(`[${name}#${i}] empty slug (label="${label}")`);
      continue;
    }
    if (!label) fail(`[${name}] empty label for slug "${value}"`);
    if (seen.has(value)) {
      fail(`[${name}] duplicate slug "${value}" (also at #${seen.get(value)})`);
    } else {
      seen.set(value, i);
    }
    if (!SLUG_RE.test(value)) {
      console.warn(`WARN [${name}] non-URL-safe slug: "${value}"`);
      warnings++;
    }
  }
  console.log(`  ${name}: ${options.length} entries checked`);
}

console.log('Checking controlled vocabulary...');
check('services', service_options);
check('seasons', season_options);
check('hymns', hymn_options);
check('languages', language_options);

// --- The form and the API must ship the same vocabulary. ---
const apiJson = readFileSync(here('../src/data/vocab.generated.json'), 'utf8');
const formJson = readFileSync(here('../../phe-landing-page/src/vocab.generated.json'), 'utf8');
if (apiJson !== formJson) fail('phe-landing-page/src/vocab.generated.json differs from the API copy');
const body = (p: string) => readFileSync(here(p), 'utf8').replace(/^[\s\S]*?(?=^import generated)/m, '');
if (body('../src/data/options.ts') !== body('../../phe-landing-page/src/options.data.ts')) {
  fail('phe-landing-page/src/options.data.ts differs from src/data/options.ts below the header');
}
console.log('  form/API copies compared');

// --- Every link points at a known slug. ---
const hymns = new Map(vocab.hymns.map((h) => [h.slug, h]));
const seasons = new Set(vocab.seasons.map((s) => s.slug));
const services = new Set(vocab.services.map((s) => s.slug));
const types = new Set(vocab.hymnTypes.map((t) => t.slug));
const tunes = new Set(vocab.tunes.map((t) => t.slug));
const placed = new Set<string>();
const labelsInPair = new Map<string, Map<string, string>>();
for (const [hymn, season, service] of vocab.placements) {
  if (!hymns.has(hymn)) fail(`placement names unknown hymn "${hymn}"`);
  if (!seasons.has(season)) fail(`placement names unknown season "${season}"`);
  if (!services.has(service)) fail(`placement names unknown service "${service}"`);
  const h = hymns.get(hymn);
  if (!h?.active) continue;
  placed.add(hymn);
  const pair = `${season}|${service}`;
  if (!labelsInPair.has(pair)) labelsInPair.set(pair, new Map());
  const other = labelsInPair.get(pair)!.get(h.label);
  if (other && other !== hymn) fail(`"${h.label}" is both ${other} and ${hymn} in ${pair}`);
  labelsInPair.get(pair)!.set(h.label, hymn);
}
for (const h of vocab.hymns) {
  if (h.active && !placed.has(h.slug)) fail(`active hymn "${h.slug}" has no season + service`);
  for (const t of h.types) if (!types.has(t)) fail(`hymn "${h.slug}" has unknown type "${t}"`);
  for (const t of h.tunes) if (!tunes.has(t)) fail(`hymn "${h.slug}" has unknown tune "${t}"`);
}
console.log(`  placements: ${vocab.placements.length} checked across ${labelsInPair.size} season + service lists`);

// --- mappings.json only names real slugs. ---
const maps = JSON.parse(readFileSync(here('../data/hazzat/mappings.json'), 'utf8'));
for (const section of ['crosswalk', 'retired', 'needsReview'] as const) {
  for (const slug of Object.keys(maps[section])) {
    if (!slug.startsWith('_') && !hymns.has(slug)) fail(`mappings.${section} names unknown slug "${slug}"`);
  }
}
for (const [slug, keeper] of Object.entries(maps.retired as Record<string, string>)) {
  if (slug.startsWith('_')) continue;
  if (hymns.get(slug)?.active) fail(`retired hymn "${slug}" is still active`);
  if (!hymns.get(keeper)?.active) fail(`retired hymn "${slug}" points at "${keeper}", which is not active`);
}
console.log('  mappings.json checked');

console.log(`\n${failures} failure(s), ${warnings} warning(s).`);
if (failures > 0) {
  process.exit(1);
}
console.log('Vocabulary OK.');
