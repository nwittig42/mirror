import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-only Next.js badge, moved off the dashboard sidebar's upgrade button.
  devIndicators: { position: "bottom-right" },
  // Printed report PDFs run a headless browser; these must stay real Node
  // packages, not bundled.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // The PDF maker reads the report's stylesheet from disk at runtime.
  outputFileTracingIncludes: {
    "/**": ["./src/report/report.css"],
  },
};

export default nextConfig;
