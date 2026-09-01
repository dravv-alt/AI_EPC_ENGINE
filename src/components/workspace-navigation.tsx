"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Boxes,
  Camera,
  CalendarRange,
  Cuboid,
  CircleAlert,
  ChartNoAxesCombined,
  ClipboardCheck,
  FilePenLine,
  FileCheck2,
  FolderOpen,
  FolderKanban,
  GitCompareArrows,
  Grid2X2,
  ListChecks,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  MapPinned,
  ShieldCheck,
  Ship,
  Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";

type WorkspaceHref = "/" | "/projects" | "/sources" | "/requirements" | "/systems" | "/rack-model" | "/evidence" | "/field-capture" | "/readiness" | "/schedule" | "/actions" | "/cx" | "/shipments" | "/compliance" | "/knowledge" | "/graph" | "/command-center" | "/changes" | "/turnover" | "/financial-modeler" | "/technology-drafts" | "/site-analysis";
export type WorkspaceLink = [LucideIcon, string, WorkspaceHref];

export const primaryWorkspaceLinks: WorkspaceLink[] = [
  [FolderKanban, "Projects", "/projects"],
  [Grid2X2, "Overview", "/"],
  [MapPinned, "Site Analysis", "/site-analysis"],
  [ClipboardCheck, "Readiness", "/readiness"],
  [CircleAlert, "Issues", "/actions"]
];

export const workspaceGroups: Array<{ label: string; links: WorkspaceLink[] }> = [
  { label: "Project records", links: [[FolderOpen, "Documents", "/sources"], [ListChecks, "Requirements", "/requirements"], [Wrench, "Systems & Assets", "/systems"], [Cuboid, "Digital Rack Model", "/rack-model"], [Archive, "Evidence", "/evidence"], [Camera, "Capture Evidence", "/field-capture"]] },
  { label: "Delivery", links: [[CalendarRange, "Schedule", "/schedule"], [Boxes, "Commissioning Tests", "/cx"], [Ship, "Shipments & Logistics", "/shipments"]] },
  { label: "Assurance", links: [[FileCheck2, "Compliance", "/compliance"], [GitCompareArrows, "Change Control", "/changes"], [Network, "Traceability", "/graph"], [ShieldCheck, "Turnover & Closeout", "/turnover"]] },
  { label: "Commercial", links: [[ChartNoAxesCombined, "Financial Modeler · Beta", "/financial-modeler"], [FilePenLine, "Technology Draft Studio", "/technology-drafts"]] },
  { label: "Project Tools", links: [[Search, "Knowledge Search", "/knowledge"], [Bell, "Alert Center", "/command-center"]] }
];

// All 17 original workspace routes remain mapped and permanently visible.
// Knowledge and alerts also retain their global top-bar shortcuts.
export const workspaceLinks = [...primaryWorkspaceLinks, ...workspaceGroups.flatMap((group) => group.links)];

function routeIsActive(pathname: string, href: WorkspaceHref) {
  return pathname === href || href !== "/" && pathname.startsWith(`${href}/`);
}

type Project = { id: string; name: string; code: string; role: string };
type Profile = { user: { displayName: string; email: string; provider: string } };

export function WorkspaceNavigation({ projectName }: { projectName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [switching, setSwitching] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setCollapsed(localStorage.getItem("pramana-sidebar-collapsed") !== "false");
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("pramana-sidebar-collapsed", String(next));
      return next;
    });
  }

  function handleBrandClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!collapsed) return;
    event.preventDefault();
    toggleSidebar();
  }
  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((response) => response.ok ? response.json() : Promise.reject(new Error("projects"))),
      fetch("/api/profile").then((response) => response.ok ? response.json() : Promise.reject(new Error("profile")))
    ]).then(([projectResult, profileResult]) => {
      setProjects(projectResult.projects);
      setActiveProjectId(projectResult.activeProjectId);
      setProfile(profileResult);
    }).catch(() => undefined);
  }, []);

  async function activate(projectId: string) {
    if (!projectId || projectId === activeProjectId) return;
    setSwitching(true);
    const response = await fetch(`/api/projects/${projectId}/activate`, { method: "POST" });
    if (response.ok) {
      setActiveProjectId(projectId);
      router.push("/");
      router.refresh();
    }
    setSwitching(false);
  }

  const initials = useMemo(() => (profile?.user.displayName ?? "User")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(""), [profile]);

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Primary navigation">
      <div className="sidebar-brand-row">
        <Link className="brand" href="/" prefetch={false} onClick={handleBrandClick} title={collapsed ? "Expand navigation" : "Pramana Control Center"}><span className="brand-mark"><img src="/brand/pramana-mark.png" alt="" /></span><span className="brand-name">pramana<span className="brand-muted">.cx</span></span></Link>
        <button className="sidebar-toggle" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleSidebar(); }} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
      </div>
      <label className="project-switcher">
        <span className="project-dot" />
        <span className="sr-only">Active project</span>
        {projects.length ? (
          <select aria-label="Active project" value={activeProjectId} disabled={switching} onChange={(event) => activate(event.target.value)}>
            {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
          </select>
        ) : <span>{projectName}</span>}
      </label>
      <nav className="nav-list" aria-label="Project areas">
        <div className="nav-primary">
          {primaryWorkspaceLinks.map(([Icon, label, href]) => (
            <Link prefetch={false} aria-current={routeIsActive(pathname, href) ? "page" : undefined} aria-label={label} title={collapsed ? label : undefined} className={`nav-item ${routeIsActive(pathname, href) ? "is-active" : ""}`} href={href as Route} key={href}>
              <Icon size={18} /><span>{label}</span>
            </Link>
          ))}
        </div>
        {workspaceGroups.map((group) => (
          <section className="nav-group" key={group.label} aria-labelledby={`nav-group-${group.label.toLowerCase()}`}>
            <h2 className="nav-group-label" id={`nav-group-${group.label.toLowerCase()}`}>{group.label}</h2>
            <div className="nav-children">
              {group.links.map(([Icon, label, href]) => (
                <Link prefetch={false} aria-current={routeIsActive(pathname, href) ? "page" : undefined} aria-label={label} title={collapsed ? label : undefined} className={`nav-item ${routeIsActive(pathname, href) ? "is-active" : ""}`} href={href as Route} key={href}>
                  <Icon size={18} /><span>{label}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </nav>
      <div className="sidebar-footer">
        <Link aria-current={pathname === "/settings" ? "page" : undefined} aria-label="Settings" title={collapsed ? "Settings" : undefined} className={`nav-item ${pathname === "/settings" ? "is-active" : ""}`} href="/settings"><Settings size={18} /><span>Settings</span></Link>
        <div className="profile-menu">
          <Link aria-label="Profile and security" className={`user-card ${pathname === "/profile" ? "is-active" : ""}`} href="/profile">
            <span className="avatar">{initials}</span>
            <span className="profile-summary"><b>{profile?.user.displayName ?? "Your profile"}</b><small>{profile?.user.provider === "development" ? "Development · identity & security" : profile?.user.email ?? "Identity and security"}</small></span>
          </Link>
          <aside className="profile-glance" aria-label="Profile summary">
            <div className="avatar">{initials}</div><div><p className="eyebrow">Signed-in profile</p><b>{profile?.user.displayName ?? "Your profile"}</b><span>{profile?.user.email ?? "Identity not loaded"}</span></div>
            <dl><div><dt>Session</dt><dd>{profile?.user.provider ?? "Loading"}</dd></div><div><dt>Access</dt><dd>Identity & security</dd></div><div><dt>Project</dt><dd>{projects.find((project) => project.id === activeProjectId)?.role?.replaceAll("_", " ") ?? "Loading role"}</dd></div></dl>
          </aside>
        </div>
      </div>
    </aside>
  );
}
