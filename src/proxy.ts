import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/redis/rate-limit";

const publicClerkPaths = ["/sign-in", "/sign-up", "/pending-access", "/api/health"];
const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function nextResponse(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // This header never leaves the server. It gives the root layout a reliable
  // route key for server-rendered metadata, including dynamic feature pages.
  requestHeaders.set("x-pramana-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function isPublicClerkPath(pathname: string) {
  return publicClerkPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Cross-origin boundary check for state-changing API calls. Per-route
 * permission checks remain authoritative; this only refuses requests a browser
 * has already labelled as cross-site, or that declare a foreign Origin.
 */
function requestBoundaryRejection(request: NextRequest) {
  if (!mutationMethods.has(request.method.toUpperCase())) return null;

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const allowedOrigins = new Set(
      [request.nextUrl.origin, process.env.APP_BASE_URL].filter((value): value is string => Boolean(value)),
    );
    if (!allowedOrigins.has(origin)) {
      return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
    }
  }

  return null;
}

/**
 * Every /api/* request passes the shared per-IP budget before any route body
 * runs. Per-route category limits (auth, upload, AI, export, schedule) are
 * stricter and still apply; this is the blanket backstop that also covers
 * routes with no category of their own.
 */
async function applyApiBoundary(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) return nextResponse(request);

  // The public workspace is seeded with representative records. Keep it
  // inspectable while preventing anonymous visitors from altering shared data.
  if (process.env.DEMO_MODE === "true" && mutationMethods.has(request.method.toUpperCase())) {
    return NextResponse.json({ error: "This public demo is read-only." }, { status: 403 });
  }

  const rejection = requestBoundaryRejection(request);
  if (rejection) return rejection;

  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${address}:${request.nextUrl.pathname.startsWith("/api/projects") ? "project-api" : "api"}`;
  const result = await checkRateLimit(key);
  const headers = { "x-ratelimit-remaining": String(result.remaining), "x-ratelimit-backend": result.backend };
  if (!result.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Retry shortly." },
      { status: 429, headers: { ...headers, "retry-after": String(result.retryAfter) } },
    );
  }
  const response = nextResponse(request);
  Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

const withClerk = clerkMiddleware(async (auth, request) => {
  if (!isPublicClerkPath(request.nextUrl.pathname)) await auth.protect();
  return applyApiBoundary(request);
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (process.env.AUTH_MODE === "clerk") return withClerk(request, event);
  return applyApiBoundary(request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
