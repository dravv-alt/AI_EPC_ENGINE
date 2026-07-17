"use client";

import { useEffect } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";

const legacyRoutes: Record<string, Route> = {
  actions: "/actions",
  changes: "/changes",
  compliance: "/compliance",
  cx: "/cx",
  evidence: "/evidence",
  graph: "/graph",
  knowledge: "/knowledge",
  readiness: "/readiness",
  requirements: "/requirements",
  schedule: "/schedule",
  shipments: "/shipments",
  sources: "/sources",
  "source-upload": "/sources",
  systems: "/systems",
  turnover: "/turnover"
};

/** Keeps links from the original single-page prototype useful after real routes were introduced. */
export function HashRouteRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/") return;
    const route = legacyRoutes[window.location.hash.slice(1).toLowerCase()];
    if (route) router.replace(route);
  }, [pathname, router]);

  return null;
}
