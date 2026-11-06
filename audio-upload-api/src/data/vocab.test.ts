import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hymn_options, hymnsByPair, matchesOption, vocab } from './options';

/** A lint over the generated vocabulary: what contributors read in the dropdowns. */
const labels = [
  ...vocab.seasons.map((s) => s.label),
  ...vocab.services.map((s) => s.label),
  ...vocab.languages.map((l) => l.label),
  ...vocab.hymns.filter((h) => h.active).map((h) => h.label),
];

describe('vocabulary labels', () => {
  it('have no stray whitespace', () => {
    assert.deepEqual(labels.filter((l) => l !== l.trim() || /\s{2,}/.test(l)), []);
  });

  it('have balanced brackets', () => {
    const count = (l: string, ch: string) => l.split(ch).length - 1;
    assert.deepEqual(labels.filter((l) => count(l, '(') !== count(l, ')')), []);
  });

  it('use the corrected spellings', () => {
    assert.deepEqual(labels.filter((l) => /Ninevah|Apostles (Fast|Feast)/.test(l)), []);
  });

  it('never repeat a name within one season + service list', () => {
    const label = new Map(vocab.hymns.map((h) => [h.slug, h.label]));
    const repeated = [...hymnsByPair].filter(([, slugs]) => {
      const names = [...slugs].map((s) => label.get(s));
      return new Set(names).size !== names.length;
    });
    assert.deepEqual(repeated.map(([pair]) => pair), []);
  });

  it('never repeat a name in the full list', () => {
    const names = hymn_options.map((o) => o.label);
    assert.equal(new Set(names).size, names.length);
  });
});

describe('vocabulary contents', () => {
  it('offers Greek and keeps every language slug recordings may use', () => {
    const slugs = vocab.languages.map((l) => l.slug);
    for (const slug of ['lang-coptic', 'lang-arabic', 'lang-english', 'lang-greek']) assert.ok(slugs.includes(slug), slug);
  });

  it('orders services as a church day, escape values last', () => {
    const order = [...vocab.services].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.slug);
    assert.deepEqual(order.slice(0, 4), ['vespers', 'vesper-praises', 'midnight-praises', 'matins']);
    assert.deepEqual(order.slice(-2), ['other', 'unknown']);
  });

  it('serviceOrder in mappings.json names every service', () => {
    const maps = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/hazzat/mappings.json', import.meta.url)), 'utf8'));
    const listed = (maps.serviceOrder as string[]).filter((s) => !s.startsWith('_')).sort();
    assert.deepEqual(listed, vocab.services.map((s) => s.slug).sort());
  });
});

describe('matchesOption', () => {
  const hymn = hymn_options.find((o) => o.labelAr)!;

  it('finds a hymn by its Arabic name, ignoring diacritics', () => {
    const plain = hymn.labelAr!.replace(/[ً-ٰٟ]/g, '');
    assert.ok(matchesOption(hymn, plain.slice(0, Math.min(6, plain.length))));
  });

  it('finds by English name regardless of case', () => {
    assert.ok(matchesOption(hymn, hymn.label.toUpperCase().slice(0, 5)));
  });

  it('does not match unrelated text', () => {
    assert.equal(matchesOption(hymn, 'zzzz-no-such-hymn'), false);
  });
});
