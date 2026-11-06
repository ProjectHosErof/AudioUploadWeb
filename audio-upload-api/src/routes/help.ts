import { Hono } from 'hono';
import { sendEmail } from '../lib/email';
import { helpSchema } from '../lib/validation';
import { supportReference } from '../lib/supportReference';
import { supportRequest } from '../emails/templates';
import { verifyTurnstile } from '../middleware/turnstile';
import { helpRateLimit } from '../middleware/rateLimit';

export const help = new Hono<{ Bindings: Env }>();

/**
 * "Get help": one email to the support inbox per request, with Reply-To set to
 * the person so answering is just Reply. Nothing is stored, so if the mail
 * can't be sent the page is told (503) and offers the address instead —
 * a silent failure would lose the request.
 *
 * No copy goes to the person: mailing an address someone typed would make
 * this a way to send mail to anyone.
 */
help.post('/', helpRateLimit(), async (c) => {
  const parsed = helpSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', fields: Object.keys(parsed.error.flatten().fieldErrors) }, 400);
  }

  const ip = c.req.header('cf-connecting-ip') ?? undefined;
  if (!(await verifyTurnstile(c.env, parsed.data.turnstile_token, ip))) {
    return c.json({ error: 'Verification failed. Please retry the challenge.' }, 403);
  }

  const reference = supportReference();
  const built = supportRequest(parsed.data, {
    reference,
    userAgent: c.req.header('user-agent') ?? null,
    receivedAt: new Date(),
  });
  const sent = await sendEmail(c.env, { to: c.env.SUPPORT_INBOX, replyTo: parsed.data.email, ...built });
  if (!sent) {
    // sendEmail has logged the cause (without the address or message).
    console.error('support request not delivered', { reference, topic: parsed.data.topic });
    return c.json({ error: "We couldn't send that just now. Please email support@hoserof.org instead." }, 503);
  }
  return c.json({ reference });
});
