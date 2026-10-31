import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE = "Project Hos Erof";
const ORIGIN = "https://hoserof.org";
/** The home page's title, also set in index.html for the first paint and link previews. */
export const HOME_TITLE = "Project Hos Erof — Preserving the Hymns of the Coptic Church";
/** The home page's description, matching index.html. */
export const HOME_DESCRIPTION =
  "A community collection of Coptic Orthodox hymns and responses. Share a recording of a hymn — any quality, straight from your phone — and help preserve the tradition.";

/** The single tag in <head> for a selector, created if index.html lacks it. */
function headTag<T extends HTMLElement>(selector: string, create: () => T): T {
  let el = document.head.querySelector<T>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Set the browser tab title, description and canonical address for the
 * current page. Every route calls this — otherwise what one page set (e.g. a
 * legal page) would linger on the next. Pass null for the home page.
 *
 * The canonical address is this page's own path: index.html's points at the
 * home page, and left alone it would tell search engines every page is a
 * copy of the home page.
 */
export function usePageTitle(title: string | null, description: string = HOME_DESCRIPTION): void {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : HOME_TITLE;

    headTag<HTMLMetaElement>('meta[name="description"]', () => {
      const m = document.createElement("meta");
      m.name = "description";
      return m;
    }).content = description;

    headTag<HTMLLinkElement>('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.rel = "canonical";
      return l;
    }).href = `${ORIGIN}${pathname}`;
  }, [title, description, pathname]);
}
