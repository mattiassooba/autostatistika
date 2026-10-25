import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { SITE_NAME, SITE_URL } from "./site";

/** Share image written at build time by app/og/[locale]/[kind]/[file]/route.tsx. */
export function ogImagePath(locale: string, kind: "site" | "brand" | "month", name: string): string {
  return `/og/${locale}/${kind}/${name}.png`;
}

/** Title, description, canonical + hreflang and share cards for one page. `path` excludes the locale. */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  image,
}: {
  locale: string;
  path: string;
  title: string;
  description: string;
  image: string;
}): Metadata {
  const languages = Object.fromEntries(routing.locales.map((code) => [code, `/${code}${path}`]));
  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: title },
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ...languages, "x-default": `/${routing.defaultLocale}${path}` },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: `/${locale}${path}`,
      locale: locale === "et" ? "et_EE" : "en_GB",
      alternateLocale: locale === "et" ? "en_GB" : "et_EE",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
