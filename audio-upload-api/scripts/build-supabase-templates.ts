/**
 * Write the branded sign-in emails to supabase-templates/, ready to paste into
 * Supabase → Authentication → Email Templates. Generated from
 * src/emails/auth.ts; never edit the HTML by hand (`check:emails` would fail).
 *
 * Usage: npm run emails:supabase
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SUPABASE_TEMPLATES } from '../src/emails/auth';

const dir = fileURLToPath(new URL('../supabase-templates/', import.meta.url));
for (const t of SUPABASE_TEMPLATES) {
  writeFileSync(dir + t.file, t.build().html + '\n');
  console.log(`wrote supabase-templates/${t.file}  (Supabase tab: ${t.tab}; subject: "${t.build().subject}")`);
}
