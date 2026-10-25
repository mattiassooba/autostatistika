import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // /data/ holds the explorer's JSON slices: nothing to index there.
    rules: { userAgent: "*", allow: "/", disallow: "/data/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
