import { z } from 'zod';

/**
 * Accepted audio MIME types → canonical file extension. Mirrors the
 * `accept` attribute on the frontend's file input (WAV/MP3/FLAC/AIFF/OGG).
 */
export const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/ogg': 'ogg',
  'application/ogg': 'ogg',
  'audio/vorbis': 'ogg',
};

export const ALLOWED_CONTENT_TYPES = Object.keys(CONTENT_TYPE_TO_EXT);

/**
 * Body of POST /uploads/initiate. Slug existence (service/season/hymn/language)
 * is validated against the DB reference tables in the route; here we only check
 * shape, the content-type allowlist, and a positive declared size.
 */
export const initiateSchema = z.object({
  service_slug: z.string().min(1).max(100),
  season_slug: z.string().min(1).max(100),
  hymn_slug: z.string().min(1).max(200),
  languages: z.array(z.string().min(1).max(50)).min(1).max(10),
  content_type: z
    .string()
    .refine((t) => ALLOWED_CONTENT_TYPES.includes(t), { message: 'Unsupported audio format' }),
  size_bytes: z.number().int().positive(),
  original_filename: z.string().max(512).optional(),
  wants_updates: z.boolean().default(false),
  email: z.string().email().max(254).optional(),
  turnstile_token: z.string().min(1),
});

export type InitiateInput = z.infer<typeof initiateSchema>;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Body of POST /admin/recordings/:id/review.
 *
 * A rejection must carry a reason — it becomes the contributor-facing
 * explanation and the audit record, and "rejected, no reason given" is the one
 * outcome that helps nobody. Approvals may carry an optional note.
 */
export const reviewSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(1).max(500).optional(),
    /** Set when rejecting as a duplicate of an existing recording. */
    duplicate_of_id: z.string().regex(UUID_RE).optional(),
  })
  .refine((v) => v.decision !== 'reject' || Boolean(v.reason), {
    message: 'A reason is required when rejecting a recording',
    path: ['reason'],
  })
  .refine((v) => v.decision !== 'approve' || !v.duplicate_of_id, {
    message: 'duplicate_of_id only applies to a rejection',
    path: ['duplicate_of_id'],
  });

export type ReviewInput = z.infer<typeof reviewSchema>;

/**
 * Body of POST /subscribe.
 *
 * `source` is not accepted from the browser as free text — only the two known
 * origins — so the column stays analysable and a caller can't write junk into
 * it. The landing form omits it entirely.
 */
export const subscribeSchema = z.object({
  email: z.string().trim().email().max(254),
  source: z.enum(['landing', 'upload']).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
