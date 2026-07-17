import { clerkIsConfigured, env } from "@/lib/env";
import { developmentIdentity, type AuthIdentity } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";

export class AuthenticationError extends Error {
  readonly status = 401;
}

/**
 * The only auth entry point used by domain routes. The Clerk adapter belongs
 * here when credentials are supplied; development mode never impersonates a
 * production identity and is intentionally labelled in the UI.
 */
export async function getCurrentIdentity(): Promise<AuthIdentity> {
  if (env.AUTH_MODE === "credentials") {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Authentication is required for this route.");
    return { userId: user.id, email: user.email, displayName: user.displayName, role: "viewer", provider: "credentials" };
  }
  if (env.AUTH_MODE === "clerk") {
    if (!clerkIsConfigured) {
      throw new Error("AUTH_MODE is clerk but Clerk keys are not configured.");
    }

    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const session = await auth();
    const user = await currentUser();
    if (!session.userId || !user) throw new AuthenticationError("Authentication is required for this route.");

    return {
      userId: session.userId,
      email: user.primaryEmailAddress?.emailAddress ?? "unknown@clerk.local",
      displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Pramana member",
      role: "viewer",
      provider: "clerk"
    };
  }

  return developmentIdentity;
}
