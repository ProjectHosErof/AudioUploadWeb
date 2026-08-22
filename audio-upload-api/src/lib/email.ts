/**
 * Outbound email, via Resend's HTTP API.
 *
 * It has to be an HTTP API rather than SMTP: Workers cannot open the raw TCP
 * connection SMTP needs, so a conventional mail library is not an option here.
 *
 * Nothing in this module throws. Sending mail is always a side effect of some
 * more important action — a moderation decision, a signup — and a mail outage
 * must never turn one of those into a failed request. Callers get a boolean and
 * the failure detail goes to the log.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Always send one. Some clients prefer it, and spam filters expect it. */
  text: string;
  /**
   * One-click unsubscribe endpoint (RFC 8058). Set it on anything recurring:
   * Gmail and Yahoo expect it from bulk senders, and its absence costs
   * deliverability for everyone else. Note the URL is called with **POST**,
   * not GET — see the route in src/routes/subscribe.ts.
   */
  unsubscribeUrl?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendEmail(env: Env, message: EmailMessage): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    // Deliberately not an error: local dev and CI run without a key, and the
    // rest of the request should behave exactly as it does in production.
    console.warn('email skipped — RESEND_API_KEY is not configured', { to: redact(message.to) });
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        // Replies land in a real inbox rather than vanishing. The From address
        // stays on the sending subdomain (which protects the apex domain's
        // reputation); Reply-To needs no verification of its own.
        ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.unsubscribeUrl ? { headers: unsubscribeHeaders(env, message.unsubscribeUrl) } : {}),
      }),
    });

    if (!res.ok) {
      // Resend explains refusals (unverified domain, invalid address) in the
      // body, and that detail is the difference between a five-minute fix and
      // an afternoon, so log it rather than just the status.
      console.error('email send failed', res.status, await res.text().catch(() => ''));
      return false;
    }

    // Log the provider's id: without it there is no way to answer "did we
    // actually send it?" when somebody says a message never arrived.
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    console.log('email sent', { to: redact(message.to), id: body?.id ?? 'unknown' });
    return true;
  } catch (err) {
    console.error('email request failed', err);
    return false;
  }
}

/**
 * RFC 8058 one-click unsubscribe.
 *
 * Both forms are offered: the URL is what Gmail and Yahoo surface as an
 * "Unsubscribe" button next to the sender, and the mailto is the fallback for
 * clients that only understand that. List-Unsubscribe-Post is what makes the
 * button one-click rather than sending the reader to a web page — and it is
 * also what makes the request a POST.
 */
function unsubscribeHeaders(env: Env, url: string): Record<string, string> {
  const headers: Record<string, string> = {
    'List-Unsubscribe': env.EMAIL_REPLY_TO
      ? `<${url}>, <mailto:${env.EMAIL_REPLY_TO}?subject=unsubscribe>`
      : `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
  return headers;
}

/** Keep full addresses out of the logs; enough remains to correlate a report. */
function redact(address: string): string {
  const [local, domain] = address.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
