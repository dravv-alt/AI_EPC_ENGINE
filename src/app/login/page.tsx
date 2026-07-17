import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { env } from "@/lib/env";
export default function LoginPage() { if (env.AUTH_MODE !== "credentials") redirect("/"); return <LoginForm />; }
