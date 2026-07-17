import type { Metadata } from "next";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { AuthBoundary } from "@/components/auth-boundary";

export const metadata: Metadata = {
  title: "Pramana Cx | Commissioning intelligence",
  description: "Evidence-backed readiness for mission-critical EPC delivery."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthBoundary>{children}</AuthBoundary></body></html>;
}
