import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AuthBoundary } from "@/components/auth-boundary";
import { CopilotLauncher } from "@/components/copilot/copilot-launcher";
import { HashRouteRedirect } from "@/components/hash-route-redirect";
import { ThemeToggle } from "@/components/theme-toggle";
import { CookieNotice } from "@/components/cookie-notice";
import { RouteTitle } from "@/components/route-title";
import { env } from "@/lib/env";
import { getRouteSeo } from "@/lib/seo";

const baseMetadata: Metadata = {
  metadataBase: new URL("https://pramana-cx.vercel.app"),
  title: {
    default: "Pramana Cx | EPC commissioning intelligence",
    template: "%s | Pramana Cx"
  },
  description: "Evidence-backed readiness, delivery coordination, and governed commissioning intelligence for mission-critical EPC projects.",
  applicationName: "Pramana Cx",
  keywords: ["EPC commissioning", "data centre delivery", "construction readiness", "evidence management", "project controls", "Pramana Cx"],
  authors: [{ name: "Pramana Cx" }],
  creator: "Pramana Cx",
  publisher: "Pramana Cx",
  category: "Engineering software",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }]
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Pramana Cx",
    title: "Pramana Cx | EPC commissioning intelligence",
    description: "Evidence-backed readiness, delivery coordination, and governed commissioning intelligence for mission-critical EPC projects."
  },
  twitter: {
    card: "summary",
    title: "Pramana Cx | EPC commissioning intelligence",
    description: "Evidence-backed readiness, delivery coordination, and governed commissioning intelligence for mission-critical EPC projects."
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 }
  }
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pramana-pathname") ?? "/";
  const seo = getRouteSeo(pathname);
  return {
    ...baseMetadata,
    title: seo.title,
    description: seo.description,
    alternates: { canonical: pathname },
    openGraph: { ...baseMetadata.openGraph, url: pathname, title: `${seo.title} | Pramana Cx`, description: seo.description },
    twitter: { ...baseMetadata.twitter, title: `${seo.title} | Pramana Cx`, description: seo.description }
  };
}

export const viewport: Viewport = { themeColor: "#2d463e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeBootstrap = "try { var preset = localStorage.getItem('pramana-theme-preset'); var stored = localStorage.getItem('pramana-theme'); var fallback = stored === 'dark' || (!stored && matchMedia('(prefers-color-scheme: dark)').matches) ? 'midnight-bloom' : 'soft-pop'; var selected = preset || fallback; var dark = selected === 'midnight-bloom' || selected === 'northern-lights'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.dataset.palette = selected; } catch (_) {}";
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body>{env.DEMO_MODE && <div className="demo-mode-banner" role="status">Demo workspace · representative Mumbai DC-07 data</div>}<RouteTitle /><HashRouteRedirect /><AuthBoundary>{children}</AuthBoundary><div className="theme-global-control"><ThemeToggle /></div><CookieNotice /><CopilotLauncher /></body></html>;
}
