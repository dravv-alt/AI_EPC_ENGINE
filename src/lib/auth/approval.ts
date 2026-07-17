import { getCurrentIdentity } from "@/lib/auth/provider";
import { getSessionUser } from "@/lib/auth/session";

export async function requireFreshApprovalMfa(maxAgeMinutes = 10) {
  const identity = await getCurrentIdentity();
  if (identity.provider === "development") return { provider: identity.provider, verifiedAt: new Date() };
  if (identity.provider === "clerk") return { provider: identity.provider, verifiedAt: new Date() };
  const session = await getSessionUser();
  if (!session?.totpEnabled) throw new Error("TOTP enrollment is required before approval authority can be used.");
  if (!session.mfaVerifiedAt || Date.now() - session.mfaVerifiedAt.getTime() > maxAgeMinutes * 60_000) throw new Error("A fresh authenticator verification is required for this approval.");
  return { provider: identity.provider, verifiedAt: session.mfaVerifiedAt };
}
