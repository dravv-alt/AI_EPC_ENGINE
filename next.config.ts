import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      { key: "Origin-Agent-Cluster", value: "?1" },
      { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; font-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests; block-all-mixed-content" }
    ];
    if (process.env.NODE_ENV === "production") headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    return [{ source: "/(.*)", headers }];
  },
  // PDFKit loads its bundled AFM metrics from disk at runtime. Keeping it
  // external preserves those assets for controlled server-side exports.
  serverExternalPackages: ["searoute-js", "geojson-path-finder", "pdfkit"]
};

export default nextConfig;

// Development-only Cloudflare binding shim. next.config.ts is also loaded by
// `next build` and `next start`, where @opennextjs/cloudflare may not be
// installed (e.g. `npm ci --omit=dev`); an unhandled rejection there would
// terminate the server, so this is both guarded and caught.
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare")
    .then((m) => m.initOpenNextCloudflareForDev())
    .catch((error) => {
      console.warn("[next.config] Cloudflare dev bindings unavailable:", error instanceof Error ? error.message : error);
    });
}
