import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const publicClerkPaths = ["/sign-in", "/sign-up", "/pending-access", "/api/health"];
const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isPublicClerkPath(pathname: string) {
  return publicClerkPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function applyRequestBoundaryChecks(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  if (!mutationMethods.has(request.method.toUpperCase())) return NextResponse.next();

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const allowedOrigins = new Set(
      [request.nextUrl.origin, process.env.APP_BASE_URL].filter(
        (value): value is string => Boolean(value),
      ),
    );
    if (!allowedOrigins.has(origin)) {
      return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
    }
  }

  return NextResponse.next();
}

const withClerk = clerkMiddleware(async (auth, request) => {
  if (!isPublicClerkPath(request.nextUrl.pathname)) await auth.protect();
  return applyRequestBoundaryChecks(request);
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (process.env.AUTH_MODE === "clerk") return withClerk(request, event);
  return applyRequestBoundaryChecks(request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
