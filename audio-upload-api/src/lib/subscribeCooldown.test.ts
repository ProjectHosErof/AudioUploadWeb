import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIRMATION_COOLDOWN_MS, shouldSendConfirmation } from './subscribeCooldown';

const now = Date.parse('2026-10-30T12:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('shouldSendConfirmation', () => {
  it('sends to a brand-new address', () => {
    assert.equal(shouldSendConfirmation({ alreadyConfirmed: false, lastSentAt: null, now }), true);
  });

  it('never re-confirms someone already confirmed', () => {
    assert.equal(shouldSendConfirmation({ alreadyConfirmed: true, lastSentAt: null, now }), false);
  });

  it('holds back a repeat within the cooldown — the inbox-flooding case', () => {
    assert.equal(shouldSendConfirmation({ alreadyConfirmed: false, lastSentAt: ago(60_000), now }), false);
    assert.equal(
      shouldSendConfirmation({ alreadyConfirmed: false, lastSentAt: ago(CONFIRMATION_COOLDOWN_MS - 1), now }),
      false,
    );
  });

  it('allows a fresh confirmation once the cooldown has passed', () => {
    assert.equal(
      shouldSendConfirmation({ alreadyConfirmed: false, lastSentAt: ago(CONFIRMATION_COOLDOWN_MS), now }),
      true,
    );
  });

  it('does not lock anyone out on a garbled timestamp', () => {
    assert.equal(shouldSendConfirmation({ alreadyConfirmed: false, lastSentAt: 'not a date', now }), true);
  });
});
