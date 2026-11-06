import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_EMAILS_PER_RUN, dueForCheckin, nextStatus, progressFor, type BetaStatus } from './beta';

describe('nextStatus', () => {
  const cases: [BetaStatus, Parameters<typeof nextStatus>[1], BetaStatus | null][] = [
    ['unconfirmed', 'confirm', 'pending'],
    ['pending', 'confirm', null],
    ['pending', 'accept', 'accepted'],
    ['pending', 'decline', 'declined'],
    ['unconfirmed', 'accept', null],
    ['unconfirmed', 'decline', null],
    ['accepted', 'accept', null],
    ['declined', 'accept', null],
    ['accepted', 'decline', null],
    ['accepted', 'leave', 'withdrawn'],
    ['pending', 'leave', 'withdrawn'],
    ['withdrawn', 'leave', null],
    ['withdrawn', 'accept', null],
  ];
  for (const [from, action, to] of cases) {
    it(`${from} + ${action} → ${to ?? 'refused'}`, () => assert.equal(nextStatus(from, action), to));
  }
});

describe('dueForCheckin', () => {
  const now = new Date('2026-11-20T16:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  const row = (id: string, acceptedDaysAgo: number, extra: object = {}) => ({
    id,
    status: 'accepted' as BetaStatus,
    decided_at: new Date(now.getTime() - acceptedDaysAgo * day).toISOString(),
    checkin_sent_at: null as string | null,
    ...extra,
  });

  it('is due on day 7, not day 6', () => {
    const due = dueForCheckin([row('six', 6), row('seven', 7), row('nine', 9)], now).map((r) => r.id);
    assert.deepEqual(due, ['nine', 'seven']);
  });

  it('skips anyone already checked in with, not accepted, or who left', () => {
    const due = dueForCheckin(
      [row('sent', 10, { checkin_sent_at: now.toISOString() }), row('left', 10, { status: 'withdrawn' }), row('waiting', 10, { status: 'pending' })],
      now,
    );
    assert.deepEqual(due, []);
  });

  it(`sends at most ${MAX_EMAILS_PER_RUN} a run, oldest first`, () => {
    const rows = Array.from({ length: MAX_EMAILS_PER_RUN + 5 }, (_, i) => row(`t${i}`, 8 + i));
    const due = dueForCheckin(rows, now);
    assert.equal(due.length, MAX_EMAILS_PER_RUN);
    assert.equal(due[0].id, `t${MAX_EMAILS_PER_RUN + 4}`);
  });
});

describe('progressFor', () => {
  const contributors = [{ id: 'c1', email: 'mina@example.com', auth_user_id: 'u1' }];
  const rec = (contributor_id: string | null, submitter_email: string | null, created_at: string, placement_unlisted = false) => ({
    contributor_id,
    submitter_email,
    placement_unlisted,
    created_at,
  });
  const recordings = [
    rec('c1', null, '2026-11-10T10:00:00Z'),
    rec(null, 'MINA@example.com', '2026-11-12T10:00:00Z', true),
    rec(null, 'someone@else.com', '2026-11-13T10:00:00Z'),
  ];

  it('counts uploads by account and by typed email, and "not listed" picks', () => {
    assert.deepEqual(progressFor('mina@example.com', contributors, recordings), {
      signedIn: true,
      uploads: 2,
      notListed: 1,
      lastUpload: '2026-11-12T10:00:00Z',
    });
  });

  it('is empty for a tester who has done nothing yet', () => {
    assert.deepEqual(progressFor('new@example.com', contributors, recordings), {
      signedIn: false,
      uploads: 0,
      notListed: 0,
      lastUpload: null,
    });
  });
});
