import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Printed report PDFs run a headless browser; these must stay real Node
  // packages, not bundled.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // The PDF maker reads the report's stylesheet from disk at runtime.
  outputFileTracingIncludes: {
    "/**": ["./src/report/report.css"],
  },
};

export default nextConfig;
