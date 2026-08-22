/**
 * Manage the moderation allowlist (ADR-010).
 *
 * Admins are rows, not configuration, so granting and revoking access needs no
 * migration and no deploy. Invitations are keyed on EMAIL, which means you can
 * add somebody who has never signed in — auth_user_id resolves itself on their
 * first authenticated request (see src/lib/admin.ts).
 *
 * Usage:
 *   npm run admins                              # list
 *   npm run admins -- add <email> ["who they are"]
 *   npm run admins -- remove <email>
 *
 * Connects directly via Postgres (DIRECT_URL in .env), like the other
 * Node-side one-offs.
 */
import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env' });

// MIGRATE_URL first for the same reason drizzle.config.ts prefers it: the
// direct host is IPv6-only and unreachable on an IPv4-only network.
const url = process.env.MIGRATE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Missing MIGRATE_URL / DIRECT_URL / DATABASE_URL (expected in .env).');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

function normalizeEmail(raw: string): string {
  // A CHECK constraint enforces lowercase storage; normalize here so the
  // command is forgiving about how the address was typed.
  return raw.trim().toLowerCase();
}

async function list(): Promise<void> {
  const rows = await sql<
    { email: string; auth_user_id: string | null; note: string | null; created_at: Date }[]
  >`SELECT email, auth_user_id, note, created_at FROM admins ORDER BY created_at`;

  if (rows.length === 0) {
    console.log('No admins. The review queue is unreachable until you add one.');
    return;
  }

  console.log(`${rows.length} admin(s):`);
  for (const r of rows) {
    // "linked" means they have signed in at least once since being added.
    const state = r.auth_user_id ? 'linked' : 'invited — not signed in yet';
    console.log(`  ${r.email.padEnd(34)} ${state}${r.note ? `  (${r.note})` : ''}`);
  }
}

async function add(email: string, note?: string): Promise<void> {
  const rows = await sql<{ email: string }[]>`
    INSERT INTO admins (email, note)
    VALUES (${email}, ${note ?? null})
    ON CONFLICT (email) DO UPDATE SET note = COALESCE(EXCLUDED.note, admins.note)
    RETURNING email
  `;
  console.log(`✓ ${rows[0].email} is an admin.`);

  const [{ exists }] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = ${email}) AS exists
  `;
  console.log(
    exists
      ? '  They already have an account — access applies within ~60s (the admin cache TTL).'
      : '  No account yet. Access applies the first time they sign in.',
  );
}

async function remove(email: string): Promise<void> {
  // Never leave the queue orphaned: with no admins, nobody can promote a
  // recording to 'ready' and the corpus quietly stops growing.
  const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM admins`;
  const rows = await sql<{ email: string }[]>`
    DELETE FROM admins WHERE email = ${email} RETURNING email
  `;

  if (rows.length === 0) {
    console.error(`✗ ${email} is not an admin.`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${rows[0].email} is no longer an admin (effective within ~60s).`);
  if (count === 1) {
    console.warn('⚠ That was the last admin — nothing can be promoted to "ready" until you add one.');
  }
}

async function main(): Promise<void> {
  const [command, rawEmail, note] = process.argv.slice(2);

  try {
    if (!command || command === 'list') return await list();

    if (command !== 'add' && command !== 'remove') {
      console.error(`Unknown command "${command}". Expected: list | add | remove`);
      process.exitCode = 1;
      return;
    }
    if (!rawEmail) {
      console.error(`Usage: npm run admins -- ${command} <email>`);
      process.exitCode = 1;
      return;
    }

    const email = normalizeEmail(rawEmail);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      console.error(`"${rawEmail}" is not a valid email address.`);
      process.exitCode = 1;
      return;
    }

    if (command === 'add') return await add(email, note);
    return await remove(email);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
