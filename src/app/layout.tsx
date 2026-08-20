import type { Metadata, Viewport } from "next";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AuthBoundary } from "@/components/auth-boundary";
import { HashRouteRedirect } from "@/components/hash-route-redirect";

export const metadata: Metadata = {
  title: "Pramana Cx | Commissioning intelligence",
  description: "Evidence-backed readiness for mission-critical EPC delivery.",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = { themeColor: "#2d463e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeBootstrap = "try { var stored = localStorage.getItem('pramana-theme'); var theme = stored === 'dark' || (!stored && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; } catch (_) {}";
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body><HashRouteRedirect /><AuthBoundary>{children}</AuthBoundary></body></html>;
}
