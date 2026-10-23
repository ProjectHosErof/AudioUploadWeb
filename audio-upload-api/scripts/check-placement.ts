/**
 * Exercise the upload placement rule (src/lib/placement.ts) against the real
 * generated vocabulary, and check it agrees with the form's filter
 * (hymnSlugsFor in src/data/options.ts) for every season + service pair.
 *
 * Usage: npm run check:placement
 */
import { checkPlacement, ESCAPE_SLUGS as API_ESCAPES, type PlacementResult } from '../src/lib/placement';
import { ESCAPE_SLUGS as FORM_ESCAPES, hymnsByPair, hymnSlugsFor, vocab } from '../src/data/options';

const v = {
  retiredHymns: new Set(vocab.hymns.filter((h) => !h.active).map((h) => h.slug)),
  hymnsByPair: new Map([...hymnsByPair].map(([k, s]) => [k, new Set(s)])),
};

let failures = 0;
function expect(name: string, got: PlacementResult, ok: boolean, reason?: string): void {
  const pass = got.ok === ok && (ok || (!got.ok && got.reason === reason));
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(68)} -> ${got.ok ? 'allowed' : `refused (${got.reason})`}`);
  if (!pass) failures++;
}

console.log('Placement rule, specific cases:');
expect('Kiahk · Vespers · First Doxology for Kiahk', checkPlacement(v, 'kiahk', 'vespers', 'first-doxology-kiahk'), true);
expect('Kiahk · St. Gregory · Aspasmos Adam 1st Sunday (generic liturgy hymn)', checkPlacement(v, 'kiahk', 'st-gregory-liturgy', 'aspasmos-adam-first-sunday'), true);
expect('Annual · St. Basil · Penishti (Great) (St. Basil-only)', checkPlacement(v, 'annual', 'st-basil-liturgy', 'penishti-great'), true);
expect('Annual · St. Gregory · Penishti (Great) (St. Basil-only)', checkPlacement(v, 'annual', 'st-gregory-liturgy', 'penishti-great'), false, 'not_in_season_service');
expect('Good Friday · Pascha · Golgotha', checkPlacement(v, 'holy-week-good-friday', 'pascha', 'golgotha'), true);
expect('Resurrection · Matins · First Doxology for Kiahk (wrong season)', checkPlacement(v, 'resurrection', 'matins', 'first-doxology-kiahk'), false, 'not_in_season_service');
expect('Annual · Crowning · The Cherubim (Coptic Weddings occasion)', checkPlacement(v, 'annual', 'ceremony-crowning', 'the-cherubim'), true);
expect('Annual · Papal Hymns · Tovhina (Liturgy)', checkPlacement(v, 'annual', 'papal', 'tovhina-papal-2'), true);
expect('Other season · any service · Golgotha (escape hatch)', checkPlacement(v, 'other', 'vespers', 'golgotha'), true);
expect('Kiahk · Unknown service · Golgotha (escape hatch)', checkPlacement(v, 'kiahk', 'unknown', 'golgotha'), true);
expect('Annual · Unction · Golgotha (pair has no linked hymns yet)', checkPlacement(v, 'annual', 'unction', 'golgotha'), true);
expect('Kiahk · Vespers · retired week-labelled Gospel Response', checkPlacement(v, 'kiahk', 'vespers', 'first-secondweek-kiahk-gospel-response'), false, 'retired');
expect('Other · Other · retired hymn (retired beats the escape hatch)', checkPlacement(v, 'other', 'other', 'third-fourthweek-kiahk-gospel-response'), false, 'retired');

console.log('\nForm filter and API rule agree:');
const sameEscapes = [...API_ESCAPES].sort().join() === [...FORM_ESCAPES].sort().join();
console.log(`${sameEscapes ? 'PASS' : 'FAIL'}  escape slugs are the same in the form and the API`);
if (!sameEscapes) failures++;

let checked = 0;
let disagreements = 0;
for (const season of vocab.seasons) {
  for (const service of vocab.services) {
    const shown = hymnSlugsFor(season.slug, service.slug);
    for (const h of vocab.hymns.filter((x) => x.active)) {
      const formShows = shown === null || shown.has(h.slug);
      const apiAllows = checkPlacement(v, season.slug, service.slug, h.slug).ok;
      checked++;
      if (formShows !== apiAllows) disagreements++;
    }
  }
}
console.log(`${disagreements ? 'FAIL' : 'PASS'}  ${checked.toLocaleString()} season × service × hymn combinations, ${disagreements} disagreements`);
if (disagreements) failures++;

console.log(`\n${failures} failure(s).`);
process.exit(failures ? 1 : 0);
