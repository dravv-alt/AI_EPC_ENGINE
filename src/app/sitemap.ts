import type { MetadataRoute } from "next";

const publicRoutes = ["/", "/site-analysis", "/readiness", "/schedule", "/shipments", "/compliance", "/knowledge", "/cx", "/turnover"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: `https://pramana-cx.vercel.app${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.7
  }));
}
