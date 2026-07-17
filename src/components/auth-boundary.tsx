import { env } from "@/lib/env";

export async function AuthBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  if (env.AUTH_MODE !== "clerk") return children;

  const { ClerkProvider } = await import("@clerk/nextjs");
  return <ClerkProvider>{children}</ClerkProvider>;
}
