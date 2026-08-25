"use client";

import { FormEvent, useEffect, useState } from "react";
import { SignOutButton } from "@clerk/nextjs";

type Profile = {
  user: { id: string; email: string; displayName: string; totpEnabled: boolean; provider: string };
  memberships: Array<{ projectId: string; projectName: string; projectCode: string; role: string }>;
  sessions: Array<{ id: string; expiresAt: string; mfaVerifiedAt: string | null; revokedAt: string | null; userAgent: string | null; ipAddress: string | null; createdAt: string; current: boolean }>;
};

export function ProfilePanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Loading your persisted profile…");
  const [enrollment, setEnrollment] = useState<{ secret: string; uri: string } | null>(null);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");

  async function load() {
    const response = await fetch("/api/profile");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setProfile(body); setName(body.user.displayName); setMessage("");
  }
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }) });
    const body = await response.json();
    setMessage(response.ok ? "Profile updated." : body.error);
    if (response.ok) await load();
  }

  async function enroll() {
    const response = await fetch("/api/auth/totp/enroll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error);
    setEnrollment(body); setMessage("Add this account to your authenticator, then verify a six-digit code.");
  }

  async function verify() {
    const response = await fetch("/api/auth/totp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error);
    setEnrollment(null); setPassword(""); setToken(""); setMessage("Two-factor authentication enabled."); await load();
  }

  async function disableTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    const response = await fetch("/api/auth/totp/disable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: values.get("password"), token: values.get("token") }) });
    const body = await response.json(); setMessage(response.ok ? "Two-factor authentication disabled; approval authority is unavailable until it is re-enabled." : body.error);
    if (response.ok) { form.reset(); await load(); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: values.get("currentPassword"), newPassword: values.get("newPassword") }) });
    const body = await response.json(); setMessage(response.ok ? "Password changed; every other session was revoked." : body.error);
    if (response.ok) { form.reset(); await load(); }
  }

  async function revokeSession(sessionId: string, current: boolean) {
    const response = await fetch(`/api/auth/sessions/${sessionId}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error);
    if (current) return location.assign("/login");
    setMessage("Session revoked."); await load();
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); location.assign("/login"); }

  return <div className="workflow-stack">
    <form className="surface profile-form" onSubmit={save}>
      <div><p className="eyebrow">Identity</p><h2>{profile?.user.displayName ?? "Profile"}</h2><p>{profile?.user.email ?? message}</p></div>
      <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} disabled={!profile} /></label>
      <button className="button button-primary" disabled={!profile}>Save profile</button>
      {message && <p className="form-message" role="status">{message}</p>}
      {profile && <p className="workflow-hint">Provider: {profile.user.provider} · TOTP: {profile.user.totpEnabled ? "enabled" : profile.user.provider === "credentials" ? "not enabled" : "managed by your identity provider"}</p>}
    </form>
    {profile?.user.provider === "credentials" && !profile.user.totpEnabled && <section className="surface security-card">
      <div><p className="eyebrow">Approval security</p><h2>Enable authenticator codes</h2><p className="workflow-hint">Required for gate approvals and other high-authority decisions.</p></div>
      <label>{enrollment ? "Six-digit code" : "Confirm password"}<input type={enrollment ? "text" : "password"} inputMode={enrollment ? "numeric" : undefined} value={enrollment ? token : password} onChange={(event) => enrollment ? setToken(event.target.value) : setPassword(event.target.value)} /></label>
      <button type="button" className="button button-secondary" onClick={enrollment ? verify : enroll}>{enrollment ? "Verify and enable" : "Start enrollment"}</button>
      {enrollment && <div className="enrollment-secret"><p>Authenticator setup URI</p><code>{enrollment.uri}</code><p>Manual secret</p><code>{enrollment.secret}</code></div>}
    </section>}
    {profile?.user.provider === "credentials" && profile.user.totpEnabled && <form className="surface security-card" onSubmit={disableTotp}><div><p className="eyebrow">Approval security</p><h2>Authenticator enabled</h2><p className="workflow-hint">Disabling it immediately removes credentials-based approval authority.</p></div><label>Current password<input name="password" type="password" required /></label><label>Six-digit code<input name="token" inputMode="numeric" pattern="[0-9]{6}" required /></label><button className="button button-outline">Disable TOTP</button></form>}
    {profile?.user.provider === "credentials" && <form className="surface security-card" onSubmit={changePassword}><div><p className="eyebrow">Credentials</p><h2>Change password</h2><p className="workflow-hint">Changing it revokes every other active session.</p></div><label>Current password<input name="currentPassword" type="password" required /></label><label>New password<input name="newPassword" type="password" minLength={12} required /></label><button className="button button-secondary">Change password</button></form>}
    <section><div className="section-heading"><div><p className="eyebrow">Project authority</p><h2>Memberships</h2></div></div><div className="workflow-grid">{profile?.memberships.map((membership) => <article className="surface workflow-card" key={membership.projectId}><span className="source-status processed">{membership.role.replaceAll("_", " ")}</span><h2>{membership.projectName}</h2><p>{membership.projectCode}</p></article>)}</div></section>
    {profile?.user.provider === "credentials" && <section className="surface member-table"><div className="section-heading"><div><p className="eyebrow">Account security</p><h2>Session history</h2></div></div>{profile.sessions.map((session) => <article className={`entity-row ${session.revokedAt ? "is-muted" : ""}`} key={session.id}><div><b>{session.current ? "This session" : session.revokedAt ? "Revoked session" : "Active session"}</b><span>{session.userAgent ?? "Unknown device"} · {session.ipAddress ?? "IP unavailable"}<br />Created {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.createdAt))}</span></div>{!session.revokedAt && <button className="button button-outline" onClick={() => revokeSession(session.id, session.current)}>Revoke</button>}</article>)}</section>}
    {profile?.user.provider === "credentials" && <button className="button button-outline" onClick={logout}>Sign out</button>}
    {profile?.user.provider === "clerk" && <SignOutButton redirectUrl="/sign-in"><button className="button button-outline" type="button">Sign out</button></SignOutButton>}
  </div>;
}
