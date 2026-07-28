import { clerkKeysConfigured } from "@/lib/env";

export async function AuthBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!clerkKeysConfigured) return children;

  const { ClerkProvider } = await import("@clerk/nextjs");
  return <ClerkProvider>{children}</ClerkProvider>;
}
