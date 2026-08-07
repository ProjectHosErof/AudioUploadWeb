/**
 * Sanity-check the vendored controlled vocabulary (src/data/options.ts) that
 * seeds the reference tables and is validated on every upload.
 *
 * FAILS (exit 1) on empty or duplicate slugs — those silently break validation
 * or seeding. WARNS on non-URL-safe slugs (e.g. "End of Service Hymn"): allowed
 * today but flagged as debt to normalize in a coordinated pass.
 *
 * Usage: npm run check:vocab
 */
import {
  hymn_options,
  language_options,
  service_options,
  season_options,
  type SelectOption,
} from '../src/data/options';

const SLUG_RE = /^[a-z0-9-]+$/;

let failures = 0;
let warnings = 0;

function check(name: string, options: readonly SelectOption[]): void {
  const seen = new Map<string, number>();
  for (const [i, o] of options.entries()) {
    const value = o.value?.trim() ?? '';
    const label = o.label?.trim() ?? '';
    if (!value) {
      console.error(`FAIL [${name}#${i}] empty slug (label="${label}")`);
      failures++;
      continue;
    }
    if (!label) {
      console.error(`FAIL [${name}] empty label for slug "${value}"`);
      failures++;
    }
    if (seen.has(value)) {
      console.error(`FAIL [${name}] duplicate slug "${value}" (also at #${seen.get(value)})`);
      failures++;
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

console.log(`\n${failures} failure(s), ${warnings} warning(s).`);
if (failures > 0) {
  process.exit(1);
}
console.log('Vocabulary OK.');
