/**
 * Fails if supabase-templates/ is out of date with src/emails/auth.ts (or the
 * shared layout): a design change must be regenerated and re-pasted into
 * Supabase, not silently left behind. Fix: `npm run emails:supabase`.
 *
 * Usage: npm run check:emails
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SUPABASE_TEMPLATES } from '../src/emails/auth';

const dir = fileURLToPath(new URL('../supabase-templates/', import.meta.url));
let stale = 0;
for (const t of SUPABASE_TEMPLATES) {
  let committed = '';
  try {
    committed = readFileSync(dir + t.file, 'utf8');
  } catch {
    // Missing counts as stale.
  }
  if (committed !== t.build().html + '\n') {
    console.error(`FAIL supabase-templates/${t.file} is out of date — run \`npm run emails:supabase\` and re-paste it into Supabase (${t.tab}).`);
    stale++;
  }
}
if (stale) process.exit(1);
console.log(`Supabase email templates up to date (${SUPABASE_TEMPLATES.length}).`);
