import type { ReactNode } from "react";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { getCore } from "@/lib/data/store";

export async function PageShell({ children }: { children: ReactNode }) {
  const core = await getCore();
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter generatedAt={core.generatedAt} disclaimer={core.disclaimer} />
    </>
  );
}
