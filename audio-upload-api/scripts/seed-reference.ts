/**
 * Seed the reference tables (services, seasons, hymns, languages) from the
 * vendored upload-form vocabulary, so backend validation and the frontend
 * dropdowns share one source of truth.
 *
 * Usage: npm run seed
 * Connects directly via Postgres (DIRECT_URL in .env) — this is a Node-side
 * one-off, so it doesn't use supabase-js (which needs a WebSocket on Node < 22).
 */
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import {
  hymn_options,
  language_options,
  service_options,
  season_options,
  type SelectOption,
} from '../src/data/options';

dotenv.config({ path: '.env' });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Missing DIRECT_URL / DATABASE_URL (expected in .env).');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

/** Drop empties, trim labels, and dedupe by slug (first wins). */
function clean(options: readonly SelectOption[]): { slug: string; label: string }[] {
  const seen = new Set<string>();
  const rows: { slug: string; label: string }[] = [];
  for (const o of options) {
    const slug = o.value.trim();
    const label = o.label.trim();
    if (!slug || !label || seen.has(slug)) continue;
    seen.add(slug);
    rows.push({ slug, label });
  }
  return rows;
}

/** Derive rhythm from the hymn label when it's encoded, e.g. "…(Adam)". */
function deriveRhythm(label: string): string | null {
  const m = label.match(/\((adam|watos|hazaeeni|farayhi)\)/i);
  return m ? m[1].toLowerCase() : null;
}

async function main() {
  console.log(`Seeding reference data → ${url!.split('@')[1] ?? url}`);

  const services = clean(service_options);
  const seasons = clean(season_options);
  const languages = clean(language_options);
  const hymns = clean(hymn_options).map((h) => ({ ...h, rhythm: deriveRhythm(h.label) }));

  await sql`insert into services ${sql(services, 'slug', 'label')}
            on conflict (slug) do update set label = excluded.label`;
  console.log(`  ✓ services: ${services.length}`);

  await sql`insert into seasons ${sql(seasons, 'slug', 'label')}
            on conflict (slug) do update set label = excluded.label`;
  console.log(`  ✓ seasons: ${seasons.length}`);

  await sql`insert into languages ${sql(languages, 'slug', 'label')}
            on conflict (slug) do update set label = excluded.label`;
  console.log(`  ✓ languages: ${languages.length}`);

  await sql`insert into hymns ${sql(hymns, 'slug', 'label', 'rhythm')}
            on conflict (slug) do update set label = excluded.label, rhythm = excluded.rhythm`;
  console.log(`  ✓ hymns: ${hymns.length}`);

  await sql.end();
  console.log('Done.');
}

main().catch(async (e) => {
  console.error(e);
  await sql.end().catch(() => {});
  process.exit(1);
});
