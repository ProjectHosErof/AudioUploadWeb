import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  bigint,
  numeric,
  integer,
  smallint,
  boolean,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ==========================================
// 1. ENUMS — stable, small, controlled lifecycles.
//    (Vocabularies that GROW — service/season/hymn — are reference
//     tables below, NOT enums, so new values need no migration.)
// ==========================================

// Transfer lifecycle of the R2 object.
export const uploadStatusEnum = pgEnum('upload_status', [
  'pending', // row created, presigned URL issued, bytes not yet confirmed
  'uploading', // (reserved) client reported progress
  'completed', // object confirmed in R2 via HEAD
  'failed', // client/complete step reported failure
]);

// Content-acceptance lifecycle (what the contributor dashboard shows).
export const reviewStatusEnum = pgEnum('review_status', [
  'processing', // uploaded; awaiting enrichment + moderation
  'ready', // approved; eligible for the ML training corpus
  'rejected', // failed moderation or flagged as a duplicate
]);

// ==========================================
// 2. REFERENCE TABLES — controlled vocabularies seeded from the
//    frontend's options.data.ts so dropdowns and backend validation
//    share one source of truth. slug is the stable key.
// ==========================================

export const services = pgTable('services', {
  slug: varchar('slug', { length: 100 }).primaryKey(),
  label: varchar('label', { length: 200 }).notNull(),
});

export const seasons = pgTable('seasons', {
  slug: varchar('slug', { length: 100 }).primaryKey(),
  label: varchar('label', { length: 200 }).notNull(),
});

export const hymns = pgTable('hymns', {
  slug: varchar('slug', { length: 200 }).primaryKey(),
  label: varchar('label', { length: 300 }).notNull(),
  // Rhythm is often encoded in the label ("…(Adam)" vs "…(Watos)"); it lives
  // here rather than being asked of the contributor. Nullable until known.
  rhythm: varchar('rhythm', { length: 30 }),
});

export const languages = pgTable('languages', {
  slug: varchar('slug', { length: 50 }).primaryKey(),
  label: varchar('label', { length: 100 }).notNull(),
});

// ==========================================
// 3. CONTRIBUTORS — kept lean and all-nullable for now. Uploads are
//    anonymous; this table is populated in the Supabase Auth phase and
//    linked back to recordings via recordings.contributor_id.
// ==========================================

export const contributors = pgTable('contributors', {
  id: uuid('id').defaultRandom().primaryKey(),
  authUserId: uuid('auth_user_id').unique(), // Supabase auth.users(id), set on first login
  email: varchar('email', { length: 255 }).unique(),
  displayName: varchar('display_name', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ==========================================
// 3b. ADMINS — the moderation allowlist (ADR-010). Authorization is checked
//     by the Worker, not by JWT claims, so promoting someone is an INSERT
//     rather than a deploy.
//
//     Keyed on EMAIL so a moderator can be invited before they have ever
//     signed in (auth.users has no row until first login). auth_user_id is
//     resolved on their first authenticated request and is what subsequent
//     checks match on — the email fallback only ever applies to a *verified*
//     address. See src/lib/admin.ts.
// ==========================================

export const admins = pgTable('admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Stored lowercase; a CHECK constraint in migration 0004 enforces it so the
  // unique index can't be sidestepped by casing.
  email: varchar('email', { length: 255 }).notNull().unique(),
  authUserId: uuid('auth_user_id').unique(), // backfilled on first admin request
  note: varchar('note', { length: 200 }), // free-text "who is this", for the humans
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 3c. SUBSCRIBERS — the "Stay Informed" list. Separate from `contributors`
//     on purpose: subscribing is an interest in the project, contributing is
//     an act of donation, and conflating them would mean an unsubscribe had
//     to reason about someone's recordings.
//
//     Double opt-in: a row exists from the moment someone submits, but is not
//     mailable until confirmed_at is set. Without that, the public endpoint
//     would be a way to send mail to any address an attacker types.
// ==========================================

export const subscribers = pgTable('subscribers', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Stored lowercase; a CHECK constraint in migration 0005 enforces it so the
  // unique index can't be sidestepped by casing (same pattern as `admins`).
  email: varchar('email', { length: 255 }).notNull().unique(),
  // Unguessable capability for both the confirm and unsubscribe links. One
  // token for both: a leaked confirm link could unsubscribe you, which is a
  // trivial harm next to the complexity of managing two.
  token: uuid('token').defaultRandom().notNull().unique(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  // Where the signup came from: 'landing' (the Stay Informed form) or
  // 'upload' (the opt-in checkbox on the upload form).
  source: varchar('source', { length: 30 }).default('landing').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 4. RECORDINGS — one row per submission. Combines storage state,
//    liturgical metadata, offline-enrichment fields, and moderation.
// ==========================================

export const recordings = pgTable(
  'recordings',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // --- Storage (R2) ---
    r2Key: varchar('r2_key', { length: 512 }).notNull().unique(),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    originalFilename: varchar('original_filename', { length: 512 }),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    etag: varchar('etag', { length: 255 }),

    // --- Enrichment (nullable; filled by the offline ffprobe/blake3 job) ---
    contentHash: varchar('content_hash', { length: 64 }), // BLAKE3 hex, for dedup
    durationSeconds: numeric('duration_seconds', { precision: 8, scale: 2 }),
    sampleRateHz: integer('sample_rate_hz'),
    channels: smallint('channels'),
    codec: varchar('codec', { length: 50 }),

    // --- Liturgical metadata (from the upload form) ---
    serviceSlug: varchar('service_slug', { length: 100 })
      .notNull()
      .references(() => services.slug),
    seasonSlug: varchar('season_slug', { length: 100 })
      .notNull()
      .references(() => seasons.slug),
    hymnSlug: varchar('hymn_slug', { length: 200 })
      .notNull()
      .references(() => hymns.slug),
    hymnLabel: varchar('hymn_label', { length: 300 }).notNull(), // snapshot of the label at submit time
    languages: jsonb('languages').$type<string[]>().notNull(), // language slugs, e.g. ['lang-coptic']

    // --- Lifecycle ---
    uploadStatus: uploadStatusEnum('upload_status').default('pending').notNull(),
    reviewStatus: reviewStatusEnum('review_status').default('processing').notNull(),
    errorMessage: text('error_message'),

    // --- Moderation audit (Pillar C) ---
    // Who promoted or rejected this, when, and why. Populated only by an
    // admin decision — enrichment's automatic rejections leave these null and
    // explain themselves in error_message instead.
    reviewedBy: uuid('reviewed_by'), // auth.users(id); FK added in migration 0004
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewReason: text('review_reason'),

    // Structured replacement for the "duplicate of <id>" error_message pointer:
    // the surviving recording this one duplicates.
    duplicateOfId: uuid('duplicate_of_id'), // recordings(id); FK added in migration 0004

    // --- Contributor / opt-in (anonymous-friendly) ---
    contributorId: uuid('contributor_id').references(() => contributors.id, {
      onDelete: 'set null',
    }),
    submitterEmail: varchar('submitter_email', { length: 255 }),
    wantsUpdates: boolean('wants_updates').default(false).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('recordings_content_hash_idx').on(t.contentHash),
    index('recordings_upload_status_idx').on(t.uploadStatus),
    index('recordings_review_status_idx').on(t.reviewStatus),
    index('recordings_contributor_id_idx').on(t.contributorId),
    // Dedup backstop: at most one non-rejected recording per content hash.
    // The enrichment job dedups app-side first; this makes concurrent
    // enrichment race-proof at the DB level.
    uniqueIndex('recordings_unique_active_hash')
      .on(t.contentHash)
      .where(sql`${t.contentHash} is not null and ${t.reviewStatus} <> 'rejected'`),
  ],
);

// ==========================================
// 5. ML FEATURE ARTIFACTS — populated by the offline ML export over
//    'ready' recordings (mel-spectrogram windows keyed to R2). Kept for
//    the ML phase; not written by the upload API.
// ==========================================

export const mlFeatureArtifacts = pgTable('ml_feature_artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  recordingId: uuid('recording_id').references(() => recordings.id, { onDelete: 'cascade' }),

  featureType: varchar('feature_type', { length: 50 }).notNull(), // e.g. 'mel_spectrogram_128'
  r2FeatureKey: varchar('r2_feature_key', { length: 512 }).notNull().unique(),

  windowStartSec: numeric('window_start_sec', { precision: 8, scale: 2 }).notNull(),
  windowEndSec: numeric('window_end_sec', { precision: 8, scale: 2 }).notNull(),
  tensorShape: jsonb('tensor_shape').$type<number[]>().notNull(), // e.g. [1, 128, 431]

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
