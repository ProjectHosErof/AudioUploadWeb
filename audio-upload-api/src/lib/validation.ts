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
