import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlacement, placementDecision } from './placement';

const vocab = {
  retiredHymns: new Set(['old-hymn']),
  hymnsByPair: new Map([['annual|midnight-praises', new Set(['tenen'])]]),
};
const decide = (season: string, service: string, hymn: string, notListed: boolean) =>
  placementDecision(checkPlacement(vocab, season, service, hymn), notListed);

describe('placementDecision', () => {
  it('accepts a hymn on the list, unflagged', () => {
    assert.deepEqual(decide('annual', 'midnight-praises', 'tenen', false), { accept: true, unlisted: false });
  });

  it('accepts a hymn off the list when the contributor said it isn\'t listed, flagged', () => {
    assert.deepEqual(decide('annual', 'midnight-praises', 'sunday-theotokia', true), { accept: true, unlisted: true });
  });

  it('refuses a hymn off the list otherwise', () => {
    assert.deepEqual(decide('annual', 'midnight-praises', 'sunday-theotokia', false), {
      accept: false,
      reason: 'not_in_season_service',
    });
  });

  it('refuses a retired hymn even with the flag', () => {
    assert.deepEqual(decide('annual', 'midnight-praises', 'old-hymn', true), { accept: false, reason: 'retired' });
  });

  it('does not flag escape values or pairs without a list', () => {
    assert.deepEqual(decide('other', 'midnight-praises', 'anything', true), { accept: true, unlisted: false });
    assert.deepEqual(decide('annual', 'unction', 'anything', false), { accept: true, unlisted: false });
  });
});
