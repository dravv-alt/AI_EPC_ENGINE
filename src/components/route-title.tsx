"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getRouteSeo } from "@/lib/seo";

export function RouteTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const title = getRouteSeo(pathname).title;
    document.title = `${title} | Pramana Cx`;
  }, [pathname]);

  return null;
}
