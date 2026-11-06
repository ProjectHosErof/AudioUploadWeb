import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIRMATION_URL, SUPABASE_TEMPLATES } from './auth';

const readme = readFileSync(fileURLToPath(new URL('../../supabase-templates/README.md', import.meta.url)), 'utf8');

describe('Supabase sign-in templates', () => {
  for (const t of SUPABASE_TEMPLATES) {
    const built = t.build();

    it(`${t.file}: the button links to Supabase's {{ .ConfirmationURL }}, untouched`, () => {
      assert.ok(built.html.includes(`href="${CONFIRMATION_URL}"`), 'href');
      assert.doesNotMatch(built.html, /&#123;|&lbrace;|%7B/);
    });

    it(`${t.file}: uses no other template variable`, () => {
      const vars = built.html.match(/\{\{[^}]*\}\}/g) ?? [];
      assert.deepEqual([...new Set(vars)], [CONFIRMATION_URL]);
    });

    it(`${t.file}: the README gives the same subject`, () => {
      assert.ok(readme.includes(`| \`${t.file}\` | ${t.tab} | ${built.subject} |`), built.subject);
    });
  }
});
