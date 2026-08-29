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
import { CopilotLauncher } from "@/components/copilot/copilot-launcher";
import { HashRouteRedirect } from "@/components/hash-route-redirect";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Pramana Cx | Commissioning intelligence",
  description: "Evidence-backed readiness for mission-critical EPC delivery.",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = { themeColor: "#2d463e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <HashRouteRedirect />
        <AuthBoundary>{children}</AuthBoundary>
        <div className="theme-global-control">
          <ThemeToggle />
        </div>
        <CopilotLauncher />
      </body>
    </html>
  );
}
