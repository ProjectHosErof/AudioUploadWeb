import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as templates from './templates';
import * as beta from './beta';
import * as auth from './auth';
import { GALLERY } from './gallery';

/** Exports that aren't emails: helpers and constants. */
const NOT_EMAILS = new Set(['to', 'HELP_TOPIC_LABELS', 'BETA_TASKS', 'CONFIRMATION_URL', 'SUPABASE_TEMPLATES']);

describe('email gallery', () => {
  it('shows every email template', () => {
    const exported = [templates, beta, auth]
      .flatMap((m) => Object.entries(m))
      .filter(([name, value]) => typeof value === 'function' && !NOT_EMAILS.has(name))
      .map(([name]) => name);
    const shown = new Set(GALLERY.map((g) => g.template));
    assert.deepEqual(exported.filter((n) => !shown.has(n)), []);
  });

  for (const g of GALLERY) {
    it(`${g.id}: builds with a subject, HTML and text`, () => {
      const built = g.build();
      assert.ok(built.subject.trim() && built.html.trim() && built.text.trim());
    });
  }
});
