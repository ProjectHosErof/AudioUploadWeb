import { useEffect } from "react";

const SITE = "Project Hos Erof";
/** The home page's title, also set in index.html for the first paint and link previews. */
export const HOME_TITLE = "Project Hos Erof — Preserving the Hymns of the Coptic Church";

/**
 * Set the browser tab title for the current page. Every route calls this —
 * otherwise a title set by one page (e.g. a legal page) lingers on the next.
 * Pass null for the home page.
 */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : HOME_TITLE;
  }, [title]);
}
