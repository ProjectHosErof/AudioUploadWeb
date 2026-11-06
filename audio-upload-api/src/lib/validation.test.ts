import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCEPTED_TERMS_VERSIONS, helpSchema, initiateSchema } from './validation';

const valid = {
  service_slug: 'liturgy',
  season_slug: 'annual',
  hymn_slug: 'intro-to-doxologies',
  languages: ['lang-coptic'],
  content_type: 'audio/mpeg',
  size_bytes: 1000,
  turnstile_token: 'token',
  accepted_terms_version: ACCEPTED_TERMS_VERSIONS[0],
};

describe('initiateSchema: Terms consent', () => {
  it('accepts an upload that agreed to the current Terms', () => {
    const parsed = initiateSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    assert.equal(parsed.success && parsed.data.accepted_terms_version, ACCEPTED_TERMS_VERSIONS[0]);
  });

  it('rejects an upload with no Terms version', () => {
    const { accepted_terms_version: _omit, ...rest } = valid;
    const parsed = initiateSchema.safeParse(rest);
    assert.equal(parsed.success, false);
    assert.ok(!parsed.success && parsed.error.issues.some((i) => i.path[0] === 'accepted_terms_version'));
  });

  it('rejects a version the Worker does not know', () => {
    const parsed = initiateSchema.safeParse({ ...valid, accepted_terms_version: '1999-1' });
    assert.equal(parsed.success, false);
  });
});

describe('initiateSchema: phone recording formats', () => {
  for (const contentType of ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/webm', 'audio/opus']) {
    it(`accepts ${contentType}`, () => {
      assert.equal(initiateSchema.safeParse({ ...valid, content_type: contentType }).success, true);
    });
  }

  it('still rejects non-audio types', () => {
    assert.equal(initiateSchema.safeParse({ ...valid, content_type: 'video/mp4' }).success, false);
  });
});

describe('initiateSchema: "my hymn isn\'t listed"', () => {
  it('defaults to a listed hymn', () => {
    const parsed = initiateSchema.safeParse(valid);
    assert.equal(parsed.success && parsed.data.hymn_not_listed, false);
  });

  it('carries the flag when the contributor chose it', () => {
    const parsed = initiateSchema.safeParse({ ...valid, hymn_not_listed: true });
    assert.equal(parsed.success && parsed.data.hymn_not_listed, true);
  });
});

describe('helpSchema', () => {
  const ok = {
    topic: 'upload',
    message: 'The upload stopped at 40% twice.',
    email: 'mina@example.com',
    turnstile_token: 'token',
  };

  it('accepts a request and uppercases the recording reference', () => {
    const parsed = helpSchema.safeParse({ ...ok, recording_ref: '0f1e2d3c', page: '/' });
    assert.equal(parsed.success, true);
    assert.equal(parsed.success && parsed.data.recording_ref, '0F1E2D3C');
    assert.equal(parsed.success && parsed.data.signed_in, false);
  });

  for (const [name, change] of [
    ['an unknown topic', { topic: 'billing' }],
    ['a message that is too short', { message: 'help' }],
    ['a message that is too long', { message: 'x'.repeat(4001) }],
    ['a bad email', { email: 'not-an-email' }],
    ['a malformed reference', { recording_ref: 'XYZ' }],
    ['no bot-check token', { turnstile_token: '' }],
  ] as const) {
    it(`rejects ${name}`, () => {
      assert.equal(helpSchema.safeParse({ ...ok, ...change }).success, false);
    });
  }
});
