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
} from 'drizzle-orm/pg-core';

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
