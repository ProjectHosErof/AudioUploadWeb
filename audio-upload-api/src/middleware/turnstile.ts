interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Verify a Cloudflare Turnstile token server-side. Called from the initiate
 * route with the token from the request body and the client IP.
 *
 * In local dev the `.dev.vars` secret is Cloudflare's "always passes" test
 * secret, so any non-empty token succeeds.
 */
export async function verifyTurnstile(env: Env, token: string, ip?: string): Promise<boolean> {
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) return false;

  const data = (await res.json()) as TurnstileResponse;
  return data.success === true;
}
