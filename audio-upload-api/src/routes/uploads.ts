import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';
import { CONTENT_TYPE_TO_EXT, initiateSchema } from '../lib/validation';
import { verifyTurnstile } from '../middleware/turnstile';
import { rateLimit } from '../middleware/rateLimit';
import { buildObjectKey, headObject, presignPut } from '../storage/r2';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uploads = new Hono<{ Bindings: Env }>();

/**
 * POST /uploads/initiate
 * Validate metadata, create a `pending` recording row, and return a presigned
 * PUT URL for the browser to upload the audio directly to R2.
 */
uploads.post('/initiate', rateLimit({ limit: 20, windowMs: 60_000 }), async (c) => {
  const parsed = initiateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const body = parsed.data;

  // Bot check.
  const ip = c.req.header('cf-connecting-ip') ?? undefined;
  if (!(await verifyTurnstile(c.env, body.turnstile_token, ip))) {
    return c.json({ error: 'Verification failed. Please retry the challenge.' }, 403);
  }

  const maxBytes = Number(c.env.MAX_UPLOAD_BYTES);
  if (body.size_bytes > maxBytes) {
    return c.json({ error: `File exceeds the ${maxBytes} byte limit.`, maxBytes }, 413);
  }

  const supabase = getSupabase(c.env);

  // Validate controlled vocabulary against the reference tables (parallel).
  const [svc, ssn, hymn, langRows] = await Promise.all([
    supabase.from('services').select('slug').eq('slug', body.service_slug).maybeSingle(),
    supabase.from('seasons').select('slug').eq('slug', body.season_slug).maybeSingle(),
    supabase.from('hymns').select('slug, label').eq('slug', body.hymn_slug).maybeSingle(),
    supabase.from('languages').select('slug'),
  ]);

  const vocabError = svc.error ?? ssn.error ?? hymn.error ?? langRows.error;
  if (vocabError) {
    console.error('vocab lookup failed', vocabError);
    return c.json({ error: 'Validation lookup failed.' }, 500);
  }

  const invalid: string[] = [];
  if (!svc.data) invalid.push('service_slug');
  if (!ssn.data) invalid.push('season_slug');
  if (!hymn.data) invalid.push('hymn_slug');
  const allowedLangs = new Set((langRows.data ?? []).map((r) => r.slug));
  const badLangs = body.languages.filter((l) => !allowedLangs.has(l));
  if (badLangs.length) invalid.push(`languages: ${badLangs.join(', ')}`);
  if (invalid.length) {
    return c.json({ error: 'Unknown selection', fields: invalid }, 400);
  }

  const recordingId = crypto.randomUUID();
  const ext = CONTENT_TYPE_TO_EXT[body.content_type];
  const r2Key = buildObjectKey(recordingId, ext);

  const { error: insertErr } = await supabase.from('recordings').insert({
    id: recordingId,
    r2_key: r2Key,
    content_type: body.content_type,
    original_filename: body.original_filename ?? null,
    service_slug: body.service_slug,
    season_slug: body.season_slug,
    hymn_slug: body.hymn_slug,
    hymn_label: hymn.data!.label,
    languages: body.languages,
    submitter_email: body.email ?? null,
    wants_updates: body.wants_updates,
    upload_status: 'pending',
  });
  if (insertErr) {
    console.error('recordings insert failed', insertErr);
    return c.json({ error: 'Could not create submission.' }, 500);
  }

  const ttl = Number(c.env.PRESIGN_TTL_SECONDS);
  const uploadUrl = await presignPut(c.env, r2Key, ttl);

  return c.json({
    recordingId,
    r2Key,
    uploadUrl,
    method: 'PUT',
    requiredHeaders: { 'Content-Type': body.content_type },
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    maxBytes,
  });
});

/**
 * POST /uploads/:id/complete
 * Confirm the object landed in R2, record its true size/etag, and advance the
 * lifecycle so the enrichment job can pick it up.
 */
uploads.post('/:id/complete', async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) return c.json({ error: 'Invalid id' }, 400);

  const supabase = getSupabase(c.env);
  const { data: rec, error } = await supabase
    .from('recordings')
    .select('id, r2_key, upload_status')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('recordings lookup failed', error);
    return c.json({ error: 'Lookup failed.' }, 500);
  }
  if (!rec) return c.json({ error: 'Not found' }, 404);

  const head = await headObject(c.env, rec.r2_key);
  if (!head) {
    return c.json({ error: 'Upload not found in storage yet.' }, 409);
  }

  const maxBytes = Number(c.env.MAX_UPLOAD_BYTES);
  if (head.sizeBytes !== null && head.sizeBytes > maxBytes) {
    await supabase
      .from('recordings')
      .update({
        upload_status: 'failed',
        error_message: `Object size ${head.sizeBytes} exceeds limit ${maxBytes}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    return c.json({ error: 'Uploaded file exceeds the size limit.', maxBytes }, 413);
  }

  const { error: updateErr } = await supabase
    .from('recordings')
    .update({
      upload_status: 'completed',
      review_status: 'processing',
      file_size_bytes: head.sizeBytes,
      etag: head.etag,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (updateErr) {
    console.error('recordings complete update failed', updateErr);
    return c.json({ error: 'Could not finalize submission.' }, 500);
  }

  return c.json({ recordingId: id, uploadStatus: 'completed', reviewStatus: 'processing' });
});

/**
 * GET /uploads/:id — minimal status for the frontend's post-submit state.
 */
uploads.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) return c.json({ error: 'Invalid id' }, 400);

  const supabase = getSupabase(c.env);
  const { data: rec, error } = await supabase
    .from('recordings')
    .select('id, upload_status, review_status, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('recordings status failed', error);
    return c.json({ error: 'Lookup failed.' }, 500);
  }
  if (!rec) return c.json({ error: 'Not found' }, 404);

  return c.json({
    recordingId: rec.id,
    uploadStatus: rec.upload_status,
    reviewStatus: rec.review_status,
    createdAt: rec.created_at,
  });
});
