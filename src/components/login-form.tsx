"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter(); const [mfaRequired, setMfaRequired] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setMessage("Signing in…"); const data = new FormData(event.currentTarget); const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password"), totp: data.get("totp") || undefined }) }); const body = await response.json(); if (response.status === 202) { setMfaRequired(true); setMessage("Enter the code from your authenticator app."); return; } if (!response.ok) { setMessage(body.error ?? "Unable to sign in."); return; } router.replace("/"); router.refresh(); }
  return <main className="auth-screen"><section className="surface auth-card"><span className="brand-mark">P</span><p className="eyebrow">Controlled access</p><h1>Sign in to Pramana</h1><p className="subhead">Your project role and approval authority are checked on every backend operation.</p><form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{mfaRequired && <label>Authenticator code<input name="totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus /></label>}<button className="button button-primary">Sign in</button>{message && <p className="form-message">{message}</p>}</form></section></main>;
}
