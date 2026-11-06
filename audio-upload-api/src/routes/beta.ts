import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';
import { background } from '../lib/background';
import { betaApplySchema } from '../lib/validation';
import { shouldSendConfirmation } from '../lib/subscribeCooldown';
import { sendBetaConfirm } from '../lib/betaMail';
import { verifyTurnstile } from '../middleware/turnstile';
import { betaRateLimit } from '../middleware/rateLimit';
import { apiUrl, siteUrl } from '../lib/urls';

export const beta = new Hono<{ Bindings: Env }>();

/**
 * Joining the beta through the open link. Double opt-in, as the mailing list:
 * the row reaches the admin list only once its confirmation link is followed.
 */

/** The same answer whatever happened, so the form can't tell who has applied. */
const GENERIC_OK = { ok: true, message: 'Check your email to confirm your request.' } as const;

beta.post('/apply', betaRateLimit(), async (c) => {
  const parsed = betaApplySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', fields: Object.keys(parsed.error.flatten().fieldErrors) }, 400);
  }
  const ip = c.req.header('cf-connecting-ip') ?? undefined;
  if (!(await verifyTurnstile(c.env, parsed.data.turnstile_token, ip))) {
    return c.json({ error: 'Verification failed. Please retry the challenge.' }, 403);
  }

  const { email, name, parish, device, role, age_range } = parsed.data;
  const supabase = getSupabase(c.env);
  const existing = await supabase
    .from('beta_testers')
    .select('token, status, confirmation_sent_at')
    .eq('email', email)
    .maybeSingle();
  if (existing.error) {
    console.error('beta lookup failed', existing.error);
    return c.json({ error: 'Could not send your request just now. Please try again.' }, 500);
  }

  let token = existing.data?.token as string | undefined;
  if (!existing.data) {
    const created = await supabase
      .from('beta_testers')
      .insert({ email, name, parish: parish || null, device, role: role ?? null, age_range: age_range ?? null })
      .select('token')
      .single();
    if (created.error) {
      console.error('beta insert failed', created.error);
      return c.json({ error: 'Could not send your request just now. Please try again.' }, 500);
    }
    token = created.data.token as string;
  } else if (existing.data.status === 'unconfirmed') {
    // A second try before confirming: keep their latest answers.
    await supabase
      .from('beta_testers')
      .update({ name, parish: parish || null, device, role: role ?? null, age_range: age_range ?? null })
      .eq('email', email);
  }

  // Only an unconfirmed request gets a (new) confirmation, at most once a day.
  const send =
    Boolean(token) &&
    (existing.data?.status ?? 'unconfirmed') === 'unconfirmed' &&
    shouldSendConfirmation({
      alreadyConfirmed: false,
      lastSentAt: (existing.data?.confirmation_sent_at as string | null | undefined) ?? null,
      now: Date.now(),
    });
  if (send && token) {
    await supabase.from('beta_testers').update({ confirmation_sent_at: new Date().toISOString() }).eq('token', token);
    background(c, sendBetaConfirm(c.env, apiUrl(c), { email, name, token }).then(() => undefined));
  }
  return c.json(GENERIC_OK);
});

/** The link in the confirmation email: unconfirmed → pending, then to the site. */
beta.get('/confirm/:token', async (c) => {
  const site = siteUrl(c.env);
  const supabase = getSupabase(c.env);
  const { data, error } = await supabase
    .from('beta_testers')
    .select('status')
    .eq('token', c.req.param('token'))
    .maybeSingle();
  if (error) {
    console.error('beta confirm lookup failed', error);
    return c.redirect(`${site}/beta/confirmed?status=error`, 302);
  }
  if (!data || data.status === 'withdrawn') return c.redirect(`${site}/beta/confirmed?status=unknown`, 302);
  if (data.status === 'unconfirmed') {
    const updated = await supabase
      .from('beta_testers')
      .update({ status: 'pending', confirmed_at: new Date().toISOString() })
      .eq('token', c.req.param('token'))
      .eq('status', 'unconfirmed');
    if (updated.error) {
      console.error('beta confirm failed', updated.error);
      return c.redirect(`${site}/beta/confirmed?status=error`, 302);
    }
  }
  // Following the link twice is fine: it's already confirmed.
  return c.redirect(`${site}/beta/confirmed`, 302);
});

async function leave(env: Env, token: string): Promise<'ok' | 'unknown' | 'error'> {
  const { data, error } = await getSupabase(env)
    .from('beta_testers')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('token', token)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('beta leave failed', error);
    return 'error';
  }
  return data ? 'ok' : 'unknown';
}

/** One-click unsubscribe (RFC 8058): a mail provider calls this with POST. */
beta.post('/leave/:token', async (c) => {
  const result = await leave(c.env, c.req.param('token'));
  if (result === 'error') return c.json({ error: 'Could not process that just now.' }, 500);
  return c.body(null, 200);
});

/** The "Leave the beta" link in an email. */
beta.get('/leave/:token', async (c) => {
  const result = await leave(c.env, c.req.param('token'));
  const site = siteUrl(c.env);
  return c.redirect(result === 'ok' ? `${site}/beta/left` : `${site}/beta/left?status=${result}`, 302);
});
