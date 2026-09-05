import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/profile", "/settings", "/pending-access"] },
    sitemap: "https://pramana-cx.vercel.app/sitemap.xml"
  };
}
