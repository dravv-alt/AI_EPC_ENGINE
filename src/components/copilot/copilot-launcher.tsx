"use client";

import { Suspense, useCallback, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { CopilotDrawer } from "./copilot-drawer";
import styles from "./copilot.module.css";

const EXCLUDED_ROUTES = ["/login", "/sign-in", "/sign-up", "/pending-access"];

function isExcludedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXCLUDED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

// `useSearchParams()` opts a component into requiring a Suspense boundary during
// static generation (Next.js App Router). The launcher is mounted once in the root
// layout, outside `{children}`, so it wraps its hook-consuming body here rather than
// forcing every page in the app to bail out of static rendering.
export function CopilotLauncher() {
  return (
    <Suspense fallback={null}>
      <CopilotLauncherInner />
    </Suspense>
  );
}

function CopilotLauncherInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const pageContext = {
    pathname: pathname ?? "/",
    // Matches CopilotContext.searchParams's Record<string, string | undefined> shape
    // and the JSON-transport convention A0-1 established.
    searchParams: Object.fromEntries(searchParams.entries()) as Record<string, string | undefined>,
  };

  // TODO(A2-1): once POST /api/copilot/conversations exists, this creates (or reuses)
  // the active conversation for the current project. Wired defensively: the endpoint
  // doesn't exist in this wave, so the fetch 404s and is caught silently, and the
  // drawer just keeps using its local fixture transcript.
  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    try {
      const response = await fetch("/api/copilot/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageContext }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { id?: string };
      if (data.id) {
        setConversationId(data.id);
        return data.id;
      }
    } catch {
      // No-op: backend not built yet in this wave (A2-1).
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  if (isExcludedRoute(pathname)) return null;

  function handleToggle() {
    setOpen((current) => {
      const next = !current;
      if (next) void ensureConversation();
      return next;
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.launcherButton}
        onClick={handleToggle}
        aria-expanded={open}
        aria-label={open ? "Close Pramana Copilot" : "Open Pramana Copilot"}
        title="Pramana Copilot"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
      {open && (
        <CopilotDrawer
          conversationId={conversationId}
          pageContext={pageContext}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
