"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function ClerkAccountControl() {
  return <div className="clerk-account-control" aria-label="Account controls">
    <SignedOut>
      <SignInButton mode="redirect"><button className="clerk-nav-action">Sign in</button></SignInButton>
      <SignUpButton mode="redirect"><button className="clerk-nav-action is-primary">Sign up</button></SignUpButton>
    </SignedOut>
    <SignedIn>
      <UserButton showName userProfileMode="modal" />
    </SignedIn>
  </div>;
}
