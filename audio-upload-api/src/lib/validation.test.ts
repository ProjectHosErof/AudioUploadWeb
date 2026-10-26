import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCEPTED_TERMS_VERSIONS, initiateSchema } from './validation';

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
