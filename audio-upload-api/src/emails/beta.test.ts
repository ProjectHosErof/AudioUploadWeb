import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BETA_TASKS, betaCheckin, betaConfirm, betaDecline, betaSurvey, betaWaitingSummary, betaWelcome } from './beta';

const name = '<b>Mina</b> Abadir';
const leave = 'https://api.hoserof.org/beta/leave/tok';
const built = {
  confirm: betaConfirm(name, 'https://api.hoserof.org/beta/confirm/tok'),
  welcome: betaWelcome(name, { site: 'https://hoserof.org', help: 'https://hoserof.org/help', leave }),
  decline: betaDecline(name, 'https://hoserof.org'),
  checkin: betaCheckin(name, { help: 'https://hoserof.org/help', leave }),
  survey: betaSurvey(name, { survey: 'https://forms.gle/abc', leave }),
};

describe('beta emails', () => {
  for (const [kind, email] of Object.entries(built)) {
    it(`${kind}: escapes the name`, () => {
      assert.doesNotMatch(email.html, /<b>Mina<\/b>/);
      assert.match(email.html, /Dear &lt;b&gt;Mina&lt;\/b&gt;,/);
    });
  }

  for (const kind of ['welcome', 'checkin', 'survey'] as const) {
    it(`${kind}: carries the leave link`, () => {
      assert.ok(built[kind].html.includes(leave), 'html');
      assert.ok(built[kind].text.includes(leave), 'text');
    });
  }

  it('the confirmation and the decline have no leave link (nothing to leave yet, or any more)', () => {
    assert.ok(!built.confirm.html.includes('/beta/leave/'));
    assert.ok(!built.decline.html.includes('/beta/leave/'));
  });

  it('the welcome lists the five tasks and links the help page', () => {
    assert.equal(BETA_TASKS.length, 5);
    for (const t of BETA_TASKS) assert.ok(built.welcome.text.includes(t.title), t.title);
    assert.ok(built.welcome.html.includes('https://hoserof.org/help'));
  });

  it('the survey email links the survey', () => {
    assert.ok(built.survey.html.includes('https://forms.gle/abc'));
  });

  it('the waiting summary counts people grammatically', () => {
    assert.equal(betaWaitingSummary(1, 'x').subject, '1 person is waiting to join the beta');
    assert.equal(betaWaitingSummary(3, 'x').subject, '3 people are waiting to join the beta');
  });
});
