import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type ClassProps = { className?: string };

export function GlassCard({ className = "", children, ...props }: HTMLAttributes<HTMLElement> & ClassProps) {
  return <section className={`glass-card ${className}`} {...props}>{children}</section>;
}

export function Pill({ variant = "neutral", className = "", children, ...props }: HTMLAttributes<HTMLSpanElement> & ClassProps & { variant?: "neutral" | "accent" | "dark" | "danger" }) {
  return <span className={`ui-pill ui-pill-${variant} ${className}`} {...props}>{children}</span>;
}

export function IconButton({ className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & ClassProps) {
  return <button className={`ui-icon-button ${className}`} {...props}>{children}</button>;
}

export function PrimaryButton({ className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & ClassProps) {
  return <button className={`ui-primary-button ${className}`} {...props}>{children}</button>;
}

export function StatCard({ label, value, icon, detail, className = "", children }: { label: string; value: ReactNode; icon?: ReactNode; detail?: ReactNode; children?: ReactNode; className?: string }) {
  return <article className={`ui-stat-card ${className}`}>
    <div className="ui-stat-top"><span>{label}</span>{icon && <i>{icon}</i>}</div>
    <strong>{value}</strong>{detail && <small>{detail}</small>}{children}
  </article>;
}
