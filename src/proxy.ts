import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/redis/rate-limit";

const publicClerkPaths = ["/sign-in", "/sign-up", "/pending-access", "/api/health"];

function isPublicClerkPath(pathname: string) {
  return publicClerkPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

async function applyApiRateLimit(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${address}:${request.nextUrl.pathname.startsWith("/api/projects") ? "project-api" : "api"}`;
  const result = await checkRateLimit(key);
  const headers = { "x-ratelimit-remaining": String(result.remaining), "x-ratelimit-backend": result.backend };
  if (!result.allowed) return NextResponse.json({ error: "Rate limit exceeded. Retry shortly." }, { status: 429, headers: { ...headers, "retry-after": String(result.retryAfter) } });
  const response = NextResponse.next();
  Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}

const withClerk = clerkMiddleware(async (auth, request) => {
  if (!isPublicClerkPath(request.nextUrl.pathname)) await auth.protect();
  return applyApiRateLimit(request);
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (process.env.AUTH_MODE === "clerk") return withClerk(request, event);
  return applyApiRateLimit(request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
