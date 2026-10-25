import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Static export for GitHub Pages: `next build` writes the whole site to out/.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
};

export default withNextIntl(nextConfig);
