import { sendEmail } from './email';
import { siteUrl } from './urls';
import { betaCheckin, betaConfirm, betaDecline, betaSurvey, betaWelcome } from '../emails/beta';

/**
 * Sending the beta emails. Links point at the Worker (confirm and leave act on
 * the row, then redirect to the site); `apiOrigin` comes from the request, or
 * from API_ORIGIN when the daily job runs. Replies go to the support inbox.
 */

export interface BetaRecipient {
  email: string;
  name: string;
  token: string;
}

export function betaLinks(apiOrigin: string, token: string) {
  return {
    confirm: `${apiOrigin}/beta/confirm/${token}`,
    leave: `${apiOrigin}/beta/leave/${token}`,
  };
}

const replyTo = (env: Env) => env.SUPPORT_INBOX;

export function sendBetaConfirm(env: Env, apiOrigin: string, r: BetaRecipient): Promise<boolean> {
  return sendEmail(env, { to: r.email, replyTo: replyTo(env), ...betaConfirm(r.name, betaLinks(apiOrigin, r.token).confirm) });
}

export function sendBetaWelcome(env: Env, apiOrigin: string, r: BetaRecipient): Promise<boolean> {
  const site = siteUrl(env);
  const leave = betaLinks(apiOrigin, r.token).leave;
  return sendEmail(env, {
    to: r.email,
    replyTo: replyTo(env),
    unsubscribeUrl: leave,
    ...betaWelcome(r.name, { site, help: `${site}/help?topic=feedback&from=beta-email`, leave }),
  });
}

export function sendBetaDecline(env: Env, r: BetaRecipient): Promise<boolean> {
  return sendEmail(env, { to: r.email, replyTo: replyTo(env), ...betaDecline(r.name, siteUrl(env)) });
}

export function sendBetaCheckin(env: Env, apiOrigin: string, r: BetaRecipient): Promise<boolean> {
  const leave = betaLinks(apiOrigin, r.token).leave;
  return sendEmail(env, {
    to: r.email,
    replyTo: replyTo(env),
    unsubscribeUrl: leave,
    ...betaCheckin(r.name, { help: `${siteUrl(env)}/help?topic=feedback&from=beta-email`, leave }),
  });
}

export function sendBetaSurvey(env: Env, apiOrigin: string, r: BetaRecipient, survey: string): Promise<boolean> {
  const leave = betaLinks(apiOrigin, r.token).leave;
  return sendEmail(env, { to: r.email, replyTo: replyTo(env), unsubscribeUrl: leave, ...betaSurvey(r.name, { survey, leave }) });
}
