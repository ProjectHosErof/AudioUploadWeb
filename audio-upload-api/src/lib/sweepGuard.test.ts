import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSweepEnabled, maxSweepDeletions, planSweep } from './sweepGuard';

const keys = (n: number, prefix = 'raw/2026/10/') =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}.mp3`);

describe('isSweepEnabled', () => {
  it('is on only for the exact string "true"', () => {
    assert.equal(isSweepEnabled('true'), true);
    assert.equal(isSweepEnabled('false'), false);
    assert.equal(isSweepEnabled('TRUE'), false);
    assert.equal(isSweepEnabled(''), false);
    assert.equal(isSweepEnabled(undefined), false);
  });
});

describe('maxSweepDeletions', () => {
  it('never drops below the floor of 5', () => {
    assert.equal(maxSweepDeletions(0), 5);
    assert.equal(maxSweepDeletions(10), 5);
  });
  it('scales at 2% of the bucket, rounded up', () => {
    assert.equal(maxSweepDeletions(1000), 20);
    assert.equal(maxSweepDeletions(1001), 21);
  });
});

describe('planSweep', () => {
  it('deletes a couple of genuine orphans', () => {
    const all = keys(100);
    const known = new Set(all.slice(2));
    const plan = planSweep({ candidates: all, knownKeys: known, completedCount: 98, totalListed: 100 });
    assert.deepEqual(plan, { action: 'delete', keys: all.slice(0, 2) });
  });

  it('does nothing when every candidate is known', () => {
    const all = keys(10);
    const plan = planSweep({ candidates: all, knownKeys: new Set(all), completedCount: 10, totalListed: 10 });
    assert.deepEqual(plan, { action: 'delete', keys: [] });
  });

  it('aborts when the DB has no completed recordings but the bucket has audio', () => {
    const all = keys(3);
    const plan = planSweep({ candidates: all, knownKeys: new Set(), completedCount: 0, totalListed: 3 });
    assert.deepEqual(plan, { action: 'abort', reason: 'db-empty', orphans: 3 });
  });

  it('allows an empty bucket with an empty DB', () => {
    const plan = planSweep({ candidates: [], knownKeys: new Set(), completedCount: 0, totalListed: 0 });
    assert.deepEqual(plan, { action: 'delete', keys: [] });
  });

  it('deletes exactly at the cap', () => {
    const all = keys(1000);
    const known = new Set(all.slice(20));
    const plan = planSweep({ candidates: all, knownKeys: known, completedCount: 980, totalListed: 1000 });
    assert.equal(plan.action, 'delete');
    assert.equal(plan.action === 'delete' && plan.keys.length, 20);
  });

  it('aborts one over the cap — the shape of restoring an old DB dump', () => {
    const all = keys(1000);
    const known = new Set(all.slice(21));
    const plan = planSweep({ candidates: all, knownKeys: known, completedCount: 979, totalListed: 1000 });
    assert.deepEqual(plan, { action: 'abort', reason: 'blast-radius', orphans: 21 });
  });

  it('uses the floor for a small bucket', () => {
    const all = keys(12);
    const fiveOrphans = planSweep({
      candidates: all,
      knownKeys: new Set(all.slice(5)),
      completedCount: 7,
      totalListed: 12,
    });
    assert.equal(fiveOrphans.action, 'delete');

    const sixOrphans = planSweep({
      candidates: all,
      knownKeys: new Set(all.slice(6)),
      completedCount: 6,
      totalListed: 12,
    });
    assert.deepEqual(sixOrphans, { action: 'abort', reason: 'blast-radius', orphans: 6 });
  });

  it('measures the cap against every listed object, not just the old ones', () => {
    // 1000 objects in the bucket, only 30 past the cutoff, 10 of those orphaned:
    // 10 <= 20, so the sweep proceeds.
    const old = keys(30);
    const plan = planSweep({
      candidates: old,
      knownKeys: new Set(old.slice(10)),
      completedCount: 990,
      totalListed: 1000,
    });
    assert.equal(plan.action, 'delete');
  });
});
