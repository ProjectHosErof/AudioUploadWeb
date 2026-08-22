import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // DIRECT_URL (db.<ref>.supabase.co) resolves to IPv6 only. On a network
    // without IPv6 the connection is simply unreachable — and drizzle-kit
    // reports that by exiting 0 having applied nothing, which is easy to miss.
    // Set MIGRATE_URL to the *session* pooler (port 5432, IPv4) to work there.
    url: process.env.MIGRATE_URL ?? process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: true,
});