"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Boxes,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  FolderOpen,
  GitCompareArrows,
  Grid2X2,
  ListChecks,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  Sparkles,
  Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type WorkspaceHref = "/" | "/sources" | "/requirements" | "/systems" | "/evidence" | "/field-capture" | "/readiness" | "/schedule" | "/actions" | "/cx" | "/shipments" | "/compliance" | "/knowledge" | "/graph" | "/command-center" | "/changes" | "/turnover";
type WorkspaceLink = [LucideIcon, string, WorkspaceHref];

export const workspaceGroups: Array<{ label: string; links: WorkspaceLink[] }> = [
  { label: "Control", links: [[Grid2X2, "Overview", "/"], [FolderOpen, "Sources", "/sources"], [ListChecks, "Requirements", "/requirements"], [Wrench, "Systems", "/systems"], [Archive, "Evidence", "/evidence"], [ScanLine, "Field capture", "/field-capture"], [ClipboardCheck, "Readiness", "/readiness"]] },
  { label: "Deliver", links: [[CalendarRange, "Schedule", "/schedule"], [CircleAlert, "Actions", "/actions"], [Boxes, "Cx tests", "/cx"], [Ship, "Shipments", "/shipments"]] },
  { label: "Investigate", links: [[FileCheck2, "Compliance", "/compliance"], [Search, "Knowledge", "/knowledge"], [Network, "Graph & timeline", "/graph"], [Bell, "Command center", "/command-center"], [GitCompareArrows, "Changes", "/changes"], [ShieldCheck, "Turnover", "/turnover"]] }
];

export const workspaceLinks = workspaceGroups.flatMap((group) => group.links);

type Project = { id: string; name: string; code: string; role: string };
type Profile = { user: { displayName: string; email: string; provider: string } };

export function WorkspaceNavigation({ projectName }: { projectName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [switching, setSwitching] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const isCollapsed = localStorage.getItem("pramana_sidebar_collapsed") === "true";
    setCollapsed(isCollapsed);
    const appShell = document.querySelector(".app-shell");
    if (appShell && isCollapsed) {
      appShell.classList.add("is-collapsed-shell");
    }

    Promise.all([
      fetch("/api/projects").then((response) => response.ok ? response.json() : Promise.reject(new Error("projects"))),
      fetch("/api/profile").then((response) => response.ok ? response.json() : Promise.reject(new Error("profile")))
    ]).then(([projectResult, profileResult]) => {
      setProjects(projectResult.projects);
      setActiveProjectId(projectResult.activeProjectId);
      setProfile(profileResult);
    }).catch(() => undefined);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("pramana_sidebar_collapsed", String(next));
    const appShell = document.querySelector(".app-shell");
    if (appShell) {
      if (next) appShell.classList.add("is-collapsed-shell");
      else appShell.classList.remove("is-collapsed-shell");
    }
  };

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", padding: collapsed ? "0 4px" : "0 6px" }}>
        <Link className="brand" href="/" style={{ padding: 0, margin: 0 }}>
          <span className="brand-mark">P</span>
          {!collapsed && <span>pramana<span className="brand-muted">.cx</span></span>}
        </Link>
        <button 
          onClick={toggleCollapse} 
          style={{ background: "transparent", border: "none", color: "#aab9b0", padding: "6px", cursor: "pointer", display: "flex", alignItems: "center", borderRadius: "6px" }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <label className="project-switcher" title={projectName}>
        <span className="project-dot" />
        <span className="sr-only">Active project</span>
        {!collapsed && (
          projects.length ? (
            <select aria-label="Active project" value={activeProjectId} disabled={switching} onChange={(event) => activate(event.target.value)}>
              {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
          ) : <span>{projectName}</span>
        )}
      </label>

      <nav className="nav-list" aria-label="Project areas">
        {workspaceGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            {!collapsed && <span className="nav-group-label">{group.label}</span>}
            {group.links.map(([Icon, label, href]) => (
              <Link 
                className={`nav-item ${pathname === href || href !== "/" && pathname.startsWith(`${href}/`) ? "is-active" : ""}`} 
                href={href} 
                key={href}
                title={collapsed ? label : undefined}
              >
                <Icon size={18} />
                {!collapsed && <span>{label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="dev-badge"><Sparkles size={14} /> {profile?.user.provider === "development" ? "Development mode" : "Controlled session"}</div>
        )}
        <Link className={`nav-item ${pathname === "/settings" ? "is-active" : ""}`} href="/settings" title={collapsed ? "Settings & audit" : undefined}>
          <Settings size={18} />
          {!collapsed && <span>Settings & audit</span>}
        </Link>
        <Link className={`user-card ${pathname === "/profile" ? "is-active" : ""}`} href="/profile" title={collapsed ? profile?.user.displayName ?? "Profile" : undefined}>
          <span className="avatar">{initials}</span>
          {!collapsed && (
            <span>
              <b>{profile?.user.displayName ?? "Your profile"}</b>
              <small>{profile?.user.email ?? "Identity and security"}</small>
            </span>
          )}
        </Link>
      </div>
    </aside>
  );
}
