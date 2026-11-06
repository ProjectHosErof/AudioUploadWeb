/**
 * Render every email the project sends, with sample data, into one page:
 * email-previews/index.html (gitignored). Each email is shown at desktop and
 * phone widths, with its subject, inbox preview line and plain-text version.
 *
 * Usage: npm run emails:preview   then open the printed path
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GALLERY } from '../src/emails/gallery';
import { esc } from '../src/emails/layout';

const outDir = fileURLToPath(new URL('../email-previews/', import.meta.url));
mkdirSync(outDir, { recursive: true });

/** The hidden inbox preview line, read back out of the rendered email. */
function preheader(html: string): string {
  const m = html.match(/<div style="display:none;[^"]*">([^<]*)<\/div>/);
  return m ? m[1].replace(/&#39;/g, '’').replace(/&amp;/g, '&') : '';
}

const frame = (html: string, width: number) =>
  `<iframe title="Preview at ${width}px" srcdoc="${esc(`<!doctype html><html><body style="margin:0">${html}</body></html>`)}" style="width:${width}px;height:900px;border:1px solid #382218;background:#1A0E08;flex:none"></iframe>`;

const cards = GALLERY.map((g, i) => {
  const built = g.build();
  return `<section class="card" id="${g.id}">
  <p class="num">${String(i + 1).padStart(2, '0')}</p>
  <h2>${esc(g.name)}</h2>
  <dl>
    <dt>When</dt><dd>${esc(g.when)}</dd>
    <dt>Who gets it</dt><dd>${esc(g.recipient)}</dd>
    <dt>Subject</dt><dd class="subject">${esc(built.subject)}</dd>
    <dt>Inbox preview</dt><dd>${esc(preheader(built.html)) || '—'}</dd>
  </dl>
  <div class="frames">${frame(built.html, 600)}${frame(built.html, 375)}</div>
  <details><summary>Plain-text version</summary><pre>${esc(built.text)}</pre></details>
</section>`;
}).join('\n');

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Email previews · Project Hos Erof</title>
<style>
  body { margin: 0; background: #1A0E08; color: #C4B490; font: 15px/1.6 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  header, main { max-width: 1060px; margin: 0 auto; padding: 32px 20px; }
  h1 { font: 300 40px/1.1 Georgia, serif; color: #F0E8D0; margin: 0 0 8px; }
  nav a { color: #C8922A; margin-right: 14px; white-space: nowrap; font-size: 13px; }
  .card { border-top: 1px solid #382218; padding: 32px 0; }
  .num { color: #D35A67; letter-spacing: .2em; font-size: 12px; margin: 0; }
  h2 { font: 400 26px/1.2 Georgia, serif; color: #F0E8D0; margin: 4px 0 16px; }
  dl { display: grid; grid-template-columns: 130px 1fr; gap: 4px 16px; margin: 0 0 20px; }
  dt { color: #9A8B6E; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; padding-top: 3px; }
  dd { margin: 0; } .subject { color: #F0E8D0; }
  .frames { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 8px; align-items: flex-start; }
  details { margin-top: 12px; } summary { color: #C8922A; cursor: pointer; }
  pre { white-space: pre-wrap; background: #221408; border: 1px solid #382218; padding: 16px; color: #C4B490; }
</style></head>
<body>
<header>
  <h1>Email previews</h1>
  <p>Every email Project Hos Erof sends, with sample data — ${GALLERY.length} in all. Regenerate with <code>npm run emails:preview</code>.</p>
  <nav>${GALLERY.map((g) => `<a href="#${g.id}">${esc(g.name)}</a>`).join(' ')}</nav>
</header>
<main>
${cards}
</main>
</body></html>
`;

writeFileSync(outDir + 'index.html', page);
console.log(`Wrote ${GALLERY.length} email previews → ${outDir}index.html`);
