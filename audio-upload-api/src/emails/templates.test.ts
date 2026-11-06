import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reviewDigest, confirmSubscription, supportRequest, type DigestItem } from './templates';

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

describe('supportRequest', () => {
  const input = {
    topic: 'remove' as const,
    message: 'Please remove my recording of <script>alert(1)</script> Tenen, my brother is in it and did not agree.',
    email: 'mina@example.com',
    name: '<b>Mina</b>',
    recording_ref: '0F1E2D3C',
    page: '/dashboard',
    signed_in: true,
    turnstile_token: 't',
  };
  const meta = { reference: 'K7Q2XM', userAgent: 'Mozilla/5.0 (iPhone)', receivedAt: new Date('2026-11-06T20:15:00Z') };
  const built = supportRequest(input, meta);

  it('names the topic, the reference and the first words in the subject', () => {
    const [head, words] = built.subject.split(' — ');
    assert.equal(head, '[Remove my recording or data] #K7Q2XM');
    assert.ok(words.startsWith('Please remove my recording of'));
    assert.ok(words.endsWith('…') && words.length <= 50, words);
  });

  it('escapes everything the person typed in the HTML', () => {
    assert.doesNotMatch(built.html, /<script>|<b>Mina<\/b>/);
    assert.match(built.html, /&lt;script&gt;/);
  });

  it('carries every field in the text version', () => {
    for (const part of ['0F1E2D3C', '/dashboard', 'Signed in: yes', 'Mozilla/5.0 (iPhone)', '2026-11-06 20:15 UTC', '#K7Q2XM', 'mina@example.com']) {
      assert.ok(built.text.includes(part), part);
    }
  });
});
