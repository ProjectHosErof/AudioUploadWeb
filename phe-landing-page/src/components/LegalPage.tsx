import { useEffect } from "react";
import { marked } from "marked";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import privacy from "../legal/privacy-policy.md?raw";
import terms from "../legal/terms-of-service.md?raw";
import dmca from "../legal/dmca-policy.md?raw";

/**
 * /privacy, /terms and /dmca. The Markdown files in src/legal/ are the single
 * source of the legal text (reviewed as documents, see docs/legal/README.md);
 * this page only renders them. Loaded lazily from App.tsx so the Markdown
 * parser stays out of the main bundle.
 *
 * The text is ours and fixed at build time, so rendering its HTML is safe.
 */

const DOCS = { privacy, terms, dmca } as const;
export type LegalDoc = keyof typeof DOCS;

const TITLES: Record<LegalDoc, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  dmca: "Copyright Policy",
};

/**
 * The drafts mark liability clauses as GitHub-style callouts ("> [!IMPORTANT]").
 * Drop the marker so they render as a plain blockquote, which the stylesheet
 * draws as a highlighted callout.
 */
function render(markdown: string): string {
  return marked.parse(markdown.replace(/^> \[!IMPORTANT\]\n/gm, ""), { async: false });
}

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  useEffect(() => {
    document.title = `${TITLES[doc]} · Project Hos Erof`;
    window.scrollTo(0, 0);
  }, [doc]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Nav />
      <main id="main" style={{ flex: 1, padding: "calc(56px + 3rem) 1.5rem 4rem" }}>
        <article className="legal-prose" dangerouslySetInnerHTML={{ __html: render(DOCS[doc]) }} />
      </main>
      <Footer />
    </div>
  );
}
