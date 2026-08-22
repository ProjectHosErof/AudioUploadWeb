import { Hono, type Context } from 'hono';
import { getSupabase } from '../lib/supabase';
import { bearerToken, verifyUser } from '../lib/auth';
import { requireAdmin, resolveAdmin, type AdminIdentity } from '../lib/admin';
import { UUID_RE, reviewSchema } from '../lib/validation';
import { presignGet } from '../storage/r2';
import { sendEmail } from '../lib/email';
import { background } from '../lib/background';
import { recordingAccepted, recordingDeclined } from '../emails/templates';
import { siteUrl } from '../lib/urls';

/**
 * Moderation (Pillar C, ADR-008/009/010).
 *
 * Recordings wait at review_status='processing' until a human decides. This is
 * the only path to 'ready', which is the set the ML export draws from — so
 * everything here runs on service_role behind requireAdmin, never through RLS.
 */
export const admin = new Hono<{
  Bindings: Env;
  Variables: { admin: AdminIdentity };
}>();

/** Long enough to listen through a recording and decide; short enough to be a non-event if leaked. */
const PLAYBACK_TTL_SECONDS = 15 * 60;

const QUEUE_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * GET /admin/me — "should the UI show the review queue?"
 *
 * Deliberately NOT behind requireAdmin: a non-admin gets a plain
 * `{ isAdmin: false }` rather than a 403, because this is the call the client
 * makes to decide whether to render the link at all. Authorization still lives
 * on every other route; this one only saves the UI from offering a door that
 * won't open.
 */
admin.get('/me', async (c) => {
  const token = bearerToken(c.req.header('authorization'));
  if (!token) return c.json({ isAdmin: false });

  const user = await verifyUser(c.env, token);
  if (!user) return c.json({ isAdmin: false });

  try {
    return c.json({ isAdmin: Boolean(await resolveAdmin(c.env, user)) });
  } catch (err) {
    console.error('admin self-check failed', err);
    return c.json({ isAdmin: false });
  }
});

// Everything below is admin-only.
admin.use('/queue', requireAdmin());
admin.use('/recordings/*', requireAdmin());

// Shape of a queue row (labels arrive via PostgREST FK-embedded resources).
interface QueueRow {
  id: string;
  hymn_label: string;
  languages: string[] | null;
  duration_seconds: string | number | null;
  sample_rate_hz: number | null;
  channels: number | null;
  codec: string | null;
  content_type: string;
  file_size_bytes: string | number | null;
  original_filename: string | null;
  created_at: string;
  submitter_email: string | null;
  services: { label: string } | null;
  seasons: { label: string } | null;
  contributors: { email: string | null; display_name: string | null } | null;
}

/**
 * GET /admin/queue — recordings awaiting a decision, oldest first.
 *
 * Oldest-first is deliberate: a queue worked newest-first starves its tail,
 * and a contributor's first submission is the one most worth answering
 * promptly.
 *
 * Only `upload_status='completed'` rows appear — a pending row has no bytes in
 * R2 yet, and the janitor reaps the abandoned ones.
 */
admin.get('/queue', async (c) => {
  const supabase = getSupabase(c.env);

  const limitParam = Number(c.req.query('limit'));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), MAX_PAGE_SIZE)
      : QUEUE_PAGE_SIZE;
  const offsetParam = Number(c.req.query('offset'));
  const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? Math.trunc(offsetParam) : 0;

  const { data, error, count } = await supabase
    .from('recordings')
    .select(
      `id, hymn_label, languages, duration_seconds, sample_rate_hz, channels, codec,
       content_type, file_size_bytes, original_filename, created_at, submitter_email,
       services(label), seasons(label), contributors(email, display_name)`,
      { count: 'exact' },
    )
    .eq('review_status', 'processing')
    .eq('upload_status', 'completed')
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('moderation queue failed', error);
    return c.json({ error: 'Could not load the review queue.' }, 500);
  }

  const items = ((data ?? []) as unknown as QueueRow[]).map((row) => ({
    id: row.id,
    title: row.hymn_label,
    service: row.services?.label ?? null,
    season: row.seasons?.label ?? null,
    languages: row.languages ?? [],
    // numeric columns come back from PostgREST as strings.
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    sampleRateHz: row.sample_rate_hz,
    channels: row.channels,
    codec: row.codec,
    contentType: row.content_type,
    fileSizeBytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes),
    originalFilename: row.original_filename,
    uploadedAt: row.created_at,
    contributor: row.contributors?.display_name ?? row.contributors?.email ?? row.submitter_email,
    // Enrichment fills the technical fields; without them there is nothing to
    // judge but the audio itself, so the UI flags it rather than hiding it.
    isEnriched: row.codec !== null,
  }));

  return c.json({ items, total: count ?? 0, limit, offset });
});

/**
 * GET /admin/recordings/:id/audio — a short-lived presigned R2 GET.
 *
 * The bytes go R2 → browser directly, exactly as they arrived, so the Worker
 * never proxies audio and Range requests (scrubbing) work natively.
 */
admin.get('/recordings/:id/audio', async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) return c.json({ error: 'Invalid id' }, 400);

  const supabase = getSupabase(c.env);
  const { data, error } = await supabase
    .from('recordings')
    .select('r2_key, content_type, upload_status')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('audio lookup failed', error);
    return c.json({ error: 'Could not load that recording.' }, 500);
  }
  if (!data) return c.json({ error: 'Not found' }, 404);
  if (data.upload_status !== 'completed') {
    return c.json({ error: 'That recording has no stored audio yet.' }, 409);
  }

  const url = await presignGet(c.env, data.r2_key as string, PLAYBACK_TTL_SECONDS);
  return c.json({
    url,
    contentType: data.content_type,
    expiresInSeconds: PLAYBACK_TTL_SECONDS,
  });
});

/**
 * POST /admin/recordings/:id/review — approve or reject.
 *
 * The update is conditioned on review_status still being 'processing', so two
 * moderators racing on the same row produce one decision and one 409 rather
 * than a silent overwrite. That guard is the reason this is a filtered UPDATE
 * returning rows instead of a read-then-write.
 */
admin.post('/recordings/:id/review', async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) return c.json({ error: 'Invalid id' }, 400);

  const parsed = reviewSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const { decision, reason, duplicate_of_id } = parsed.data;
  const { user } = c.get('admin');

  const supabase = getSupabase(c.env);

  // A duplicate pointer must name a real, different recording.
  if (duplicate_of_id) {
    if (duplicate_of_id === id) {
      return c.json({ error: 'A recording cannot duplicate itself.' }, 400);
    }
    const target = await supabase
      .from('recordings')
      .select('id')
      .eq('id', duplicate_of_id)
      .maybeSingle();
    if (target.error) {
      console.error('duplicate target lookup failed', target.error);
      return c.json({ error: 'Could not verify the duplicate reference.' }, 500);
    }
    if (!target.data) return c.json({ error: 'That duplicate reference does not exist.' }, 400);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('recordings')
    .update({
      review_status: decision === 'approve' ? 'ready' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: now,
      review_reason: reason ?? null,
      duplicate_of_id: duplicate_of_id ?? null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('review_status', 'processing') // the concurrency guard
    // hymn_label and the two address paths ride along on the returned row so
    // notifying the contributor costs no extra query.
    .select('id, review_status, reviewed_at, hymn_label, submitter_email, contributors(email, display_name)')
    .maybeSingle();

  if (error) {
    // The partial unique index allows at most one non-rejected row per content
    // hash, so approving a second copy of identical audio fails here. That is
    // the DB refusing to let a duplicate into the corpus, not a server fault.
    if (error.code === '23505') {
      return c.json(
        { error: 'An identical recording is already in the collection. Reject this one as a duplicate.' },
        409,
      );
    }
    console.error('review update failed', error);
    return c.json({ error: 'Could not record your decision.' }, 500);
  }

  if (!data) {
    // Either no such recording, or somebody already decided it.
    const existing = await supabase
      .from('recordings')
      .select('review_status')
      .eq('id', id)
      .maybeSingle();
    if (!existing.data) return c.json({ error: 'Not found' }, 404);
    return c.json(
      {
        error: 'That recording has already been reviewed.',
        reviewStatus: existing.data.review_status,
      },
      409,
    );
  }

  // Past this point the decision is committed AND the concurrency guard has
  // proven this request won the race, so the contributor is mailed exactly
  // once even if two moderators click at the same moment.
  notifyContributor(c, data as unknown as ReviewedRow, decision, reason ?? null);

  return c.json({ id: data.id, reviewStatus: data.review_status, reviewedAt: data.reviewed_at });
});


/** The columns the review UPDATE returns, as far as notification cares. */
interface ReviewedRow {
  hymn_label: string;
  submitter_email: string | null;
  contributors: { email: string | null; display_name: string | null } | null;
}

/**
 * First name only, for the greeting. Anonymous contributors have no name on
 * record, and guessing one from an email local-part reads worse than no
 * greeting at all — so this returns null and the template omits the line.
 */
function firstNameOf(row: ReviewedRow): string | null {
  const full = row.contributors?.display_name?.trim();
  if (!full) return null;
  return full.split(/\s+/)[0];
}

/**
 * Tell the contributor what happened to their recording.
 *
 * Fire-and-forget: a mail outage must never turn a recorded decision into a
 * failed request, and the moderator has already moved on to the next card.
 *
 * Not everyone is reachable. An anonymous upload with no opt-in leaves no
 * address anywhere, which is the expected outcome of uploads being anonymous
 * by default (ADR-004) rather than a fault — so it is logged, not surfaced.
 */
function notifyContributor(
  c: Context<{ Bindings: Env; Variables: { admin: AdminIdentity } }>,
  row: ReviewedRow,
  decision: 'approve' | 'reject',
  reason: string | null,
): void {
  // Same coalescing GET /admin/queue uses: the linked account first, then the
  // address given at upload time.
  const recipient = row.contributors?.email ?? row.submitter_email;
  if (!recipient) {
    console.log('review notification skipped — no address for this recording');
    return;
  }

  const site = siteUrl(c.env);
  const firstName = firstNameOf(row);
  const built =
    decision === 'approve'
      ? recordingAccepted(row.hymn_label, `${site}/dashboard`, firstName)
      : recordingDeclined(row.hymn_label, reason, `${site}/#upload`, firstName);

  background(c, sendEmail(c.env, { to: recipient, ...built }));
}
