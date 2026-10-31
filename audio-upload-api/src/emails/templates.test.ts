import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reviewDigest, confirmSubscription, type DigestItem } from './templates';

const urls = { dashboard: 'https://hoserof.org/dashboard', upload: 'https://hoserof.org/#upload' };
const ok = (hymnLabel: string): DigestItem => ({ hymnLabel, accepted: true, reason: null });
const no = (hymnLabel: string, reason = 'Heavy background noise'): DigestItem => ({ hymnLabel, accepted: false, reason });

/** Every shape a digest can take, with the subject it should carry. */
const shapes: { name: string; items: DigestItem[]; subject: RegExp }[] = [
  { name: 'one accepted', items: [ok('Tenen')], subject: /^Thank you — “Tenen” is now in the collection$/ },
  { name: 'many accepted', items: [ok('A'), ok('B')], subject: /^Thank you — 2 of your recordings are in the collection$/ },
  { name: 'one declined', items: [no('A')], subject: /^About your recording of “A”$/ },
  { name: 'many declined', items: [no('A'), no('B')], subject: /^About 2 of your recordings$/ },
  { name: 'mixed, one accepted', items: [ok('A'), no('B')], subject: /^1 of your recordings is now in the collection$/ },
  { name: 'mixed, two accepted', items: [ok('A'), ok('B'), no('C')], subject: /^2 of your recordings are now in the collection$/ },
];

describe('reviewDigest', () => {
  for (const shape of shapes) {
    it(`${shape.name}: grammatical subject`, () => {
      assert.match(reviewDigest(shape.items, 'Mina', urls).subject, shape.subject);
    });

    it(`${shape.name}: says "collection", never "archive"`, () => {
      const built = reviewDigest(shape.items, 'Mina', urls);
      for (const part of [built.subject, built.html, built.text]) {
        assert.doesNotMatch(part, /archive/i);
      }
    });
  }

  it('shows the reviewer note on a decline', () => {
    const built = reviewDigest([no('A', 'The recording cuts off halfway')], null, urls);
    assert.match(built.text, /What we noticed: The recording cuts off halfway/);
  });

  it('greets by first name when known', () => {
    assert.match(reviewDigest([ok('A')], 'Mina', urls).text, /Dear Mina,/);
  });
});

describe('confirmSubscription', () => {
  it('carries the confirmation link in both HTML and text', () => {
    const built = confirmSubscription('https://api.hoserof.org/subscribe/confirm/abc');
    assert.match(built.html, /https:\/\/api\.hoserof\.org\/subscribe\/confirm\/abc/);
    assert.match(built.text, /https:\/\/api\.hoserof\.org\/subscribe\/confirm\/abc/);
  });
});
