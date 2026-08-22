/**
 * Shared shell for every outbound email.
 *
 * Mail clients strip <style> blocks and external stylesheets and almost none
 * will load a webfont, so everything here is inline and every colour is a
 * literal — the Codex palette by value, not by token. Layout is a centred
 * table because that is the one construct Outlook renders predictably.
 */

const INK = '#1A0E08';
const INK_SOFT = '#221408';
const INK_MID = '#382218';
const PARCHMENT = '#F0E8D0';
const PARCHMENT_DIM = '#C4B490';
const GOLD = '#C8922A';
const GOLD_MUTED = '#8C6820';
const MUTED = '#9A8B6E';

const DISPLAY = "Georgia, 'Times New Roman', serif";
const UI = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export interface Shell {
  /**
   * The grey line an inbox shows next to the subject. Without one the client
   * grabs whatever body copy comes first, which wastes the second-most-read
   * text in the whole message.
   */
  preheader: string;
  /** Small uppercase line above the heading. */
  eyebrow: string;
  heading: string;
  /** Pre-escaped HTML paragraphs and blocks. */
  body: string;
  cta?: { label: string; url: string };
  /** Small print under the rule — unsubscribe, context. */
  footnote?: string;
}

/** Escape anything that came from a person before it goes near this HTML. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "Dear Anthony," — omitted entirely when we don't know who they are. */
export function greeting(firstName: string | null): string {
  if (!firstName) return '';
  return `<p style="margin:0 0 16px;font-family:${UI};font-size:16px;line-height:1.7;color:${PARCHMENT_DIM};">Dear ${esc(firstName)},</p>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${UI};font-size:16px;line-height:1.7;color:${PARCHMENT_DIM};">${html}</p>`;
}

export function render(shell: Shell): string {
  const cta = shell.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
         <tr><td style="border:1px solid ${GOLD_MUTED};">
           <a href="${esc(shell.cta.url)}" style="display:inline-block;padding:13px 30px;font-family:${UI};font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};text-decoration:none;">${esc(shell.cta.label)}</a>
         </td></tr>
       </table>`
    : '';

  const footnote = shell.footnote
    ? `<hr style="border:0;border-top:1px solid ${INK_MID};margin:32px 0 20px;">
       <p style="margin:0;font-family:${UI};font-size:12px;line-height:1.6;color:${MUTED};">${shell.footnote}</p>`
    : '';

  // Hidden from the rendered email, read by the inbox list. The padding
  // characters stop the client trailing body copy in after it.
  const preheader = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(shell.preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`;

  return `<!-- Project Hos Erof -->
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${INK};margin:0;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${INK_SOFT};border:1px solid ${INK_MID};">
      <tr><td style="padding:40px 36px;">
        <p style="margin:0 0 20px;font-family:${UI};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${GOLD_MUTED};">${esc(shell.eyebrow)}</p>
        <h1 style="margin:0 0 8px;font-family:${DISPLAY};font-size:30px;font-weight:normal;line-height:1.2;color:${PARCHMENT};">${esc(shell.heading)}</h1>
        <div style="width:40px;height:1px;background-color:${GOLD_MUTED};margin:0 0 24px;"></div>
        ${shell.body}
        ${cta}
        ${footnote}
      </td></tr>
    </table>
    <p style="margin:20px 0 0;font-family:${UI};font-size:11px;letter-spacing:.1em;color:${MUTED};">Project Hos Erof</p>
  </td></tr>
</table>`;
}
