import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REFERENCE_ALPHABET, supportReference } from './supportReference';

describe('supportReference', () => {
  it('is 6 characters that cannot be misread', () => {
    for (let i = 0; i < 200; i++) {
      const ref = supportReference();
      assert.equal(ref.length, 6);
      assert.ok([...ref].every((ch) => REFERENCE_ALPHABET.includes(ch)), ref);
      assert.doesNotMatch(ref, /[01OIL]/);
    }
  });

  it('does not repeat across 1,000 requests', () => {
    const seen = new Set(Array.from({ length: 1000 }, () => supportReference()));
    assert.equal(seen.size, 1000);
  });
});
