import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { sendEmail } from './email';

const env = { RESEND_API_KEY: 'key', EMAIL_FROM: 'Project <hello@mail.example>', EMAIL_REPLY_TO: 'contact@example.org' } as unknown as Env;
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** The JSON body sendEmail posts to Resend. */
async function sentBody(message: Parameters<typeof sendEmail>[1]) {
  let body: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  assert.equal(await sendEmail(env, message), true);
  return body;
}

describe('sendEmail reply-to', () => {
  const base = { to: 'support@example.org', subject: 's', html: '<p>h</p>', text: 't' };

  it('uses the project reply-to by default', async () => {
    assert.equal((await sentBody(base)).reply_to, 'contact@example.org');
  });

  it('uses the given reply-to when there is one, so support can just reply', async () => {
    assert.equal((await sentBody({ ...base, replyTo: 'mina@example.com' })).reply_to, 'mina@example.com');
  });
});
