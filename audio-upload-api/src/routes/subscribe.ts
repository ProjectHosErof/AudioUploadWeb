import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import { background } from '../lib/background';
import { confirmSubscription } from '../emails/templates';
import { subscribeSchema } from '../lib/validation';
import { subscribeRateLimit } from '../middleware/rateLimit';
import { apiUrl, siteUrl } from '../lib/urls';

export const subscribe = new Hono<{ Bindings: Env }>();

/**
 * The "Stay Informed" mailing list.
 *
 * Double opt-in throughout: POST creates an unconfirmed row and mails a link;
 * nothing is mailable until that link is followed. Without the gate this
 * endpoint would be a way to send mail to any address an attacker types.
 */

/** One response for every outcome — see the note in the handler. */
const GENERIC_OK = {
  ok: true,
  message: 'Check your email to confirm your subscription.',
} as const;

subscribe.post('/', subscribeRateLimit(), async (c) => {
  const parsed = subscribeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const source = parsed.data.source ?? 'landing';
  const supabase = getSupabase(c.env);

  const existing = await supabase
    .from('subscribers')
    .select('id, token, confirmed_at')
    .eq('email', email)
    .maybeSingle();

  if (existing.error) {
    console.error('subscriber lookup failed', existing.error);
    return c.json({ error: 'Could not sign you up just now. Please try again.' }, 500);
  }

  let token = existing.data?.token as string | undefined;
  const alreadyConfirmed = Boolean(existing.data?.confirmed_at);

  if (existing.data) {
    // Re-subscribing after unsubscribing reactivates the row rather than
    // failing on the unique index. The token is reused so any older link in
    // their inbox still works.
    const reactivated = await supabase
      .from('subscribers')
      .update({ unsubscribed_at: null })
      .eq('id', existing.data.id)
      .select('token')
      .maybeSingle();
    if (reactivated.error) {
      console.error('subscriber reactivate failed', reactivated.error);
      return c.json({ error: 'Could not sign you up just now. Please try again.' }, 500);
    }
    token = reactivated.data?.token as string | undefined;
  } else {
    const created = await supabase
      .from('subscribers')
      .insert({ email, source })
      .select('token')
      .maybeSingle();
    if (created.error || !created.data) {
      console.error('subscriber insert failed', created.error);
      return c.json({ error: 'Could not sign you up just now. Please try again.' }, 500);
    }
    token = created.data.token as string;
  }

  // Don't re-confirm someone who already did. They still get the same response
  // below, so the endpoint reveals nothing either way.
  if (token && !alreadyConfirmed) {
    // Points at THIS Worker — the confirm route below, not the frontend.
    const built = confirmSubscription(`${apiUrl(c)}/subscribe/confirm/${token}`);
    background(
      c,
      sendEmail(c.env, {
        to: email,
        ...built,
        unsubscribeUrl: `${apiUrl(c)}/subscribe/unsubscribe/${token}`,
      }),
    );
  }

  // Every path returns this: new signup, repeat signup, already-confirmed,
  // reactivated. A different response for a known address would turn the form
  // into a way to test whether someone is on the list.
  return c.json(GENERIC_OK);
});

/**
 * Both links below are GETs followed from an email client, so they redirect to
 * a real page rather than returning JSON. They are idempotent: clicking twice
 * lands on the same page.
 */

subscribe.get('/confirm/:token', async (c) => {
  const token = c.req.param('token');
  const site = siteUrl(c.env);

  const { data, error } = await getSupabase(c.env)
    .from('subscribers')
    .update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null })
    .eq('token', token)
    .select('email')
    .maybeSingle();

  if (error) {
    console.error('subscription confirm failed', error);
    return c.redirect(`${site}/subscribed?status=error`, 302);
  }
  // An unknown token is a stale or mistyped link, not an error worth a scary
  // page — but don't claim success either.
  if (!data) return c.redirect(`${site}/subscribed?status=unknown`, 302);

  return c.redirect(`${site}/subscribed`, 302);
});

/**
 * RFC 8058 one-click unsubscribe. Mail providers call this with POST (and a
 * `List-Unsubscribe=One-Click` body) when the reader taps the Unsubscribe
 * button the client shows beside the sender. It is a machine caller, so this
 * returns a bare 200 rather than redirecting anywhere.
 *
 * Deliberately not rate-limited and not idempotency-checked: honouring an
 * unsubscribe is never something to make harder, and repeating one is free.
 */
subscribe.post('/unsubscribe/:token', async (c) => {
  const { error } = await getSupabase(c.env)
    .from('subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('token', c.req.param('token'));

  if (error) {
    console.error('one-click unsubscribe failed', error);
    return c.json({ error: 'Could not process that just now.' }, 500);
  }
  // 200 even for an unknown token: the caller is a mail provider, and the
  // outcome it cares about — "this address should stop receiving mail" — is
  // already true.
  return c.body(null, 200);
});

subscribe.get('/unsubscribe/:token', async (c) => {
  const token = c.req.param('token');
  const site = siteUrl(c.env);

  const { data, error } = await getSupabase(c.env)
    .from('subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('token', token)
    .select('email')
    .maybeSingle();

  if (error) {
    console.error('unsubscribe failed', error);
    return c.redirect(`${site}/unsubscribed?status=error`, 302);
  }
  if (!data) return c.redirect(`${site}/unsubscribed?status=unknown`, 302);

  return c.redirect(`${site}/unsubscribed`, 302);
});
