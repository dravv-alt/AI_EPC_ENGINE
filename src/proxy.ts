import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/redis/rate-limit";

export async function proxy(request: NextRequest) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${address}:${request.nextUrl.pathname.startsWith("/api/projects") ? "project-api" : "api"}`;
  const result = await checkRateLimit(key);
  const headers = { "x-ratelimit-remaining": String(result.remaining), "x-ratelimit-backend": result.backend };
  if (!result.allowed) return NextResponse.json({ error: "Rate limit exceeded. Retry shortly." }, { status: 429, headers: { ...headers, "retry-after": String(result.retryAfter) } });
  const response = NextResponse.next();
  Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}

export const config = { matcher: "/api/:path*" };
