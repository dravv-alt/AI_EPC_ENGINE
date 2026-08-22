"use client";

import Link from "next/link";
import { Menu, UserRound } from "lucide-react";
import { primaryWorkspaceLinks, workspaceGroups } from "@/components/workspace-navigation";
import type { Route } from "next";

export function MobileRouteMenu() {
  return <details className="mobile-route-menu mobile-only">
    <summary className="icon-button" aria-label="Open navigation"><Menu size={20} /></summary>
    <nav aria-label="Responsive navigation">
      {primaryWorkspaceLinks.map(([Icon, label, href]) => <Link href={href as Route} key={href}><Icon size={17} /><span>{label}</span></Link>)}
      {workspaceGroups.map((group) => <section className="mobile-route-group" key={group.label}><h2>{group.label}</h2>{group.links.map(([Icon, label, href]) => <Link href={href as Route} key={href}><Icon size={17} /><span>{label}</span></Link>)}</section>)}
      <Link href="/settings"><Menu size={17} /><span>Settings</span></Link>
      <Link href="/profile"><UserRound size={17} /><span>Profile & security</span></Link>
    </nav>
  </details>;
}
