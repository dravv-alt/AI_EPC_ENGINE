import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactStrictMode: true,
  // PDFKit loads its bundled AFM metrics from disk at runtime. Keeping it
  // external preserves those assets for controlled server-side exports.
  serverExternalPackages: ["searoute-js", "geojson-path-finder", "pdfkit"]
};

export default nextConfig;
