import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";

// "/" picks a language in the browser (the static host has no middleware):
// English for browsers that prefer English over Estonian, Estonian otherwise.
// Without JavaScript, the meta refresh goes to /et.
export const metadata: Metadata = {
  title: "Autostatistika",
  alternates: { canonical: `${SITE_URL}/et` },
  robots: { index: false, follow: true },
};

const pickLocale = `(function(){var l=navigator.languages||[navigator.language||""];for(var i=0;i<l.length;i++){var c=(l[i]||"").slice(0,2).toLowerCase();if(c==="et"||c==="en"){location.replace("/"+c+location.search+location.hash);return}}location.replace("/et"+location.search+location.hash)})();`;

export default function RootPage() {
  return (
    <html lang="et">
      <head>
        <script dangerouslySetInnerHTML={{ __html: pickLocale }} />
        <noscript>
          <meta httpEquiv="refresh" content="0; url=/et" />
        </noscript>
      </head>
      <body>
        <Link href="/et">Autostatistika</Link>
      </body>
    </html>
  );
}
