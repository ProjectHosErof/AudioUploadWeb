/**
 * Seed the reference tables from src/data/vocab.generated.json (built from the
 * hazzat.com catalogue by scripts/import_hazzat.py), so backend validation and
 * the frontend dropdowns share one source of truth.
 *
 * Vocabulary rows (services, seasons, languages, hymn types, tunes, hymns) are
 * upserted and never deleted: recordings reference them by slug. The link
 * tables (hymn types, tunes, placements) are fully derived, so they are
 * replaced wholesale inside one transaction. Running the seed twice is a no-op.
 *
 * Usage: npm run seed
 * Connects directly via Postgres (DIRECT_URL in .env) — this is a Node-side
 * one-off, so it doesn't use supabase-js (which needs a WebSocket on Node < 22).
 */
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { vocab } from '../src/data/options';

dotenv.config({ path: '.env' });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Missing DIRECT_URL / DATABASE_URL (expected in .env).');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

async function main() {
  console.log(`Seeding reference data → ${url!.split('@')[1] ?? url}`);

  const services = vocab.services.map((s) => ({ slug: s.slug, label: s.label, sort_order: s.sortOrder }));
  const seasons = vocab.seasons.map((s) => ({
    slug: s.slug,
    label: s.label,
    label_ar: s.labelAr,
    sort_order: s.sortOrder,
  }));
  const hymns = vocab.hymns.map((h) => ({
    slug: h.slug,
    label: h.label,
    label_ar: h.labelAr,
    rhythm: h.rhythm,
    hazzat_id: h.hazzatId,
    source_url: h.sourceUrl,
    is_active: h.active,
  }));
  const typeLinks = vocab.hymns.flatMap((h) => h.types.map((t) => ({ hymn_slug: h.slug, type_slug: t })));
  const tuneLinks = vocab.hymns.flatMap((h) => h.tunes.map((t) => ({ hymn_slug: h.slug, tune_slug: t })));
  const placements = vocab.placements.map(([hymn, season, service, order]) => ({
    hymn_slug: hymn,
    season_slug: season,
    service_slug: service,
    sort_order: order,
  }));

  await sql.begin(async (tx) => {
    await tx`insert into services ${tx(services)}
             on conflict (slug) do update set label = excluded.label, sort_order = excluded.sort_order`;
    await tx`insert into seasons ${tx(seasons)}
             on conflict (slug) do update set label = excluded.label, label_ar = excluded.label_ar,
               sort_order = excluded.sort_order`;
    await tx`insert into languages ${tx(vocab.languages, 'slug', 'label')}
             on conflict (slug) do update set label = excluded.label`;
    await tx`insert into hymn_types ${tx(vocab.hymnTypes, 'slug', 'label')}
             on conflict (slug) do update set label = excluded.label`;
    await tx`insert into tunes ${tx(vocab.tunes, 'slug', 'label')}
             on conflict (slug) do update set label = excluded.label`;
    // 518 rows × 7 columns stays well under Postgres' 65,535-parameter limit.
    await tx`insert into hymns ${tx(hymns)}
             on conflict (slug) do update set label = excluded.label, label_ar = excluded.label_ar,
               rhythm = excluded.rhythm, hazzat_id = excluded.hazzat_id,
               source_url = excluded.source_url, is_active = excluded.is_active`;

    // Derived links: replace, so a mapping fix also removes stale links.
    await tx`delete from hymn_type_links`;
    await tx`delete from hymn_tunes`;
    await tx`delete from hymn_placements`;
    if (typeLinks.length) await tx`insert into hymn_type_links ${tx(typeLinks)}`;
    if (tuneLinks.length) await tx`insert into hymn_tunes ${tx(tuneLinks)}`;
    for (let i = 0; i < placements.length; i += 1000) {
      await tx`insert into hymn_placements ${tx(placements.slice(i, i + 1000))}`;
    }
  });

  console.log(`  ✓ services: ${services.length}`);
  console.log(`  ✓ seasons: ${seasons.length}`);
  console.log(`  ✓ languages: ${vocab.languages.length}`);
  console.log(`  ✓ hymn types: ${vocab.hymnTypes.length}, tunes: ${vocab.tunes.length}`);
  console.log(`  ✓ hymns: ${hymns.length} (${hymns.filter((h) => !h.is_active).length} retired)`);
  console.log(`  ✓ links: ${typeLinks.length} type, ${tuneLinks.length} tune, ${placements.length} placements`);

  await sql.end();
  console.log('Done.');
}

main().catch(async (e) => {
  console.error(e);
  await sql.end().catch(() => {});
  process.exit(1);
});
