import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';
import { bearerToken, verifyUser } from '../lib/auth';
import { requireAdmin, resolveAdmin, type AdminIdentity } from '../lib/admin';
import { UUID_RE, betaDecisionSchema, betaEndSchema, reviewSchema } from '../lib/validation';
import { MAX_EMAILS_PER_RUN, nextStatus, progressFor, type BetaStatus, type ProgressContributor, type ProgressRecording } from '../lib/beta';
import { sendBetaDecline, sendBetaSurvey, sendBetaWelcome } from '../lib/betaMail';
import { apiUrl } from '../lib/urls';
import { presignGet } from '../storage/r2';

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
admin.use('/beta', requireAdmin());
admin.use('/beta/*', requireAdmin());

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
  placement_unlisted: boolean;
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
       content_type, file_size_bytes, original_filename, placement_unlisted, created_at, submitter_email,
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
    // Not on our list for this season + service; the reviewer confirms it.
    placementUnlisted: row.placement_unlisted,
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

  // The contributor is not mailed here. Decisions are batched into one digest
  // per person by the scheduled job (src/jobs/digest.ts) — moderating forty
  // recordings in one sitting must not put forty emails in one inbox.

  return c.json({ id: data.id, reviewStatus: data.review_status, reviewedAt: data.reviewed_at });
});



// ------------------------------------------------------------------
// Beta program (src/lib/beta.ts). Applications reach this list only once
// their address is confirmed (status 'pending').
// ------------------------------------------------------------------

interface BetaRow {
  id: string;
  email: string;
  name: string;
  parish: string | null;
  device: string;
  age_range: string | null;
  role: string | null;
  token: string;
  status: BetaStatus;
  created_at: string;
  confirmed_at: string | null;
  decided_at: string | null;
  checkin_sent_at: string | null;
  survey_sent_at: string | null;
}

const BETA_COLUMNS =
  'id, email, name, parish, device, age_range, role, token, status, created_at, confirmed_at, decided_at, checkin_sent_at, survey_sent_at';

/** Waiting requests, testers with their progress, and the other counts. */
admin.get('/beta', async (c) => {
  const supabase = getSupabase(c.env);
  const { data, error } = await supabase.from('beta_testers').select(BETA_COLUMNS).order('created_at', { ascending: true });
  if (error) {
    console.error('beta list failed', error);
    return c.json({ error: 'Could not load the beta list.' }, 500);
  }
  const rows = (data ?? []) as BetaRow[];
  const testers = rows.filter((r) => r.status === 'accepted');
  const emails = testers.map((t) => t.email);

  // Progress from existing data: one query each, for all testers at once.
  let contributors: ProgressContributor[] = [];
  let recordings: ProgressRecording[] = [];
  if (emails.length) {
    const found = await supabase.from('contributors').select('id, email, auth_user_id').in('email', emails);
    if (found.error) console.error('beta progress contributors failed', found.error);
    contributors = (found.data ?? []) as ProgressContributor[];
    const ids = contributors.map((k) => k.id);
    const cols = 'id, contributor_id, submitter_email, placement_unlisted, created_at';
    const [byAccount, byEmail] = await Promise.all([
      ids.length
        ? supabase.from('recordings').select(cols).eq('upload_status', 'completed').in('contributor_id', ids)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('recordings').select(cols).eq('upload_status', 'completed').in('submitter_email', emails),
    ]);
    if (byAccount.error || byEmail.error) console.error('beta progress recordings failed', byAccount.error ?? byEmail.error);
    const seen = new Map<string, ProgressRecording>();
    for (const r of [...(byAccount.data ?? []), ...(byEmail.data ?? [])] as (ProgressRecording & { id: string })[]) seen.set(r.id, r);
    recordings = [...seen.values()];
  }

  const view = (r: BetaRow) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    parish: r.parish,
    device: r.device,
    ageRange: r.age_range,
    role: r.role,
    appliedAt: r.confirmed_at ?? r.created_at,
  });
  const count = (s: BetaStatus) => rows.filter((r) => r.status === s).length;
  return c.json({
    waiting: rows.filter((r) => r.status === 'pending').map(view),
    testers: testers.map((t) => ({
      ...view(t),
      acceptedAt: t.decided_at,
      checkinSentAt: t.checkin_sent_at,
      surveySentAt: t.survey_sent_at,
      progress: progressFor(t.email, contributors, recordings),
    })),
    counts: { declined: count('declined'), withdrawn: count('withdrawn'), unconfirmed: count('unconfirmed') },
  });
});

/** Accept (sends the welcome) or decline (a short note only if asked). */
admin.post('/beta/:id/decision', async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) return c.json({ error: 'Unknown request' }, 404);
  const parsed = betaDecisionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);
  const { decision, notify } = parsed.data;

  const supabase = getSupabase(c.env);
  const { data: row, error } = await supabase.from('beta_testers').select(BETA_COLUMNS).eq('id', id).maybeSingle();
  if (error) {
    console.error('beta decision lookup failed', error);
    return c.json({ error: 'Could not record that just now.' }, 500);
  }
  if (!row) return c.json({ error: 'Unknown request' }, 404);
  const tester = row as BetaRow;
  const status = nextStatus(tester.status, decision);
  if (!status) return c.json({ error: 'This request has already been handled.' }, 409);

  const { user } = c.get('admin');
  // Conditional on the status we read, so two admins can't both decide it.
  const updated = await supabase
    .from('beta_testers')
    .update({ status, decided_at: new Date().toISOString(), decided_by: user.email })
    .eq('id', id)
    .eq('status', tester.status)
    .select('id')
    .maybeSingle();
  if (updated.error) {
    console.error('beta decision failed', updated.error);
    return c.json({ error: 'Could not record that just now.' }, 500);
  }
  if (!updated.data) return c.json({ error: 'This request has already been handled.' }, 409);

  const recipient = { email: tester.email, name: tester.name, token: tester.token };
  let emailed = false;
  if (status === 'accepted') emailed = await sendBetaWelcome(c.env, apiUrl(c), recipient);
  else if (notify) emailed = await sendBetaDecline(c.env, recipient);
  return c.json({ id, status, emailed });
});

/** End the beta: thank-you + survey to every tester not yet sent one. Repeatable. */
admin.post('/beta/end', async (c) => {
  const parsed = betaEndSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Please give the survey’s https:// link.' }, 400);

  const supabase = getSupabase(c.env);
  const { data, error } = await supabase
    .from('beta_testers')
    .select('id, email, name, token')
    .eq('status', 'accepted')
    .is('survey_sent_at', null)
    .order('decided_at', { ascending: true });
  if (error) {
    console.error('beta end lookup failed', error);
    return c.json({ error: 'Could not send the survey just now.' }, 500);
  }
  const due = data ?? [];
  let sent = 0;
  for (const t of due.slice(0, MAX_EMAILS_PER_RUN)) {
    if (await sendBetaSurvey(c.env, apiUrl(c), t, parsed.data.surveyUrl)) {
      await supabase.from('beta_testers').update({ survey_sent_at: new Date().toISOString() }).eq('id', t.id);
      sent++;
    }
  }
  return c.json({ sent, remaining: due.length - sent });
});
