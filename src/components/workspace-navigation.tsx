"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Boxes,
  CalendarRange,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  FolderOpen,
  GitCompareArrows,
  Grid2X2,
  ListChecks,
  Network,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  Sparkles,
  Wrench
} from "lucide-react";

export const workspaceLinks = [
  [Grid2X2, "Overview", "/"],
  [FolderOpen, "Sources", "/sources"],
  [ListChecks, "Requirements", "/requirements"],
  [Wrench, "Systems", "/systems"],
  [Archive, "Evidence", "/evidence"],
  [ScanLine, "Field capture", "/field-capture"],
  [ClipboardCheck, "Readiness", "/readiness"],
  [CalendarRange, "Schedule", "/schedule"],
  [CircleAlert, "Actions", "/actions"],
  [GitCompareArrows, "Changes", "/changes"],
  [Boxes, "Cx tests", "/cx"],
  [Ship, "Shipments", "/shipments"],
  [FileCheck2, "Compliance", "/compliance"],
  [Search, "Knowledge", "/knowledge"],
  [Network, "Graph & timeline", "/graph"],
  [Bell, "Command center", "/command-center"],
  [ShieldCheck, "Turnover", "/turnover"]
] as const;

type Project = { id: string; name: string; code: string; role: string };
type Profile = { user: { displayName: string; email: string; provider: string } };

export function WorkspaceNavigation({ projectName }: { projectName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [switching, setSwitching] = useState(false);

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

  return <aside className="sidebar" aria-label="Primary navigation">
    <Link className="brand" href="/"><span className="brand-mark">P</span><span>pramana<span className="brand-muted">.cx</span></span></Link>
    <label className="project-switcher">
      <span className="project-dot" />
      <span className="sr-only">Active project</span>
      {projects.length ? <select aria-label="Active project" value={activeProjectId} disabled={switching} onChange={(event) => activate(event.target.value)}>
        {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
      </select> : <span>{projectName}</span>}
    </label>
    <nav className="nav-list">
      {workspaceLinks.map(([Icon, label, href]) => <Link className={`nav-item ${pathname === href || href !== "/" && pathname.startsWith(`${href}/`) ? "is-active" : ""}`} href={href} key={href}><Icon size={18} /><span>{label}</span></Link>)}
    </nav>
    <div className="sidebar-footer">
      <div className="dev-badge"><Sparkles size={14} /> {profile?.user.provider === "development" ? "Development mode" : "Controlled session"}</div>
      <Link className={`nav-item ${pathname === "/settings" ? "is-active" : ""}`} href="/settings"><Settings size={18} /><span>Settings & audit</span></Link>
      <Link className={`user-card ${pathname === "/profile" ? "is-active" : ""}`} href="/profile"><span className="avatar">{initials}</span><span><b>{profile?.user.displayName ?? "Your profile"}</b><small>{profile?.user.email ?? "Identity and security"}</small></span></Link>
    </div>
  </aside>;
}
