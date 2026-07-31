import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Deliberately does NOT import "@/lib/auth" — that module wires up the
// Drizzle adapter, Resend, and Credentials providers, which is more than
// middleware (edge runtime) needs to carry. Decoding the JWT session cookie
// via `getToken` only needs AUTH_SECRET, keeping this dependency-light.

// "/" is the public marketing page. It is matched exactly below rather than by
// the startsWith() prefix rule — `"/".startsWith("/")` is true for every path
// on the site, so treating it as a prefix would make the entire app public.
const PUBLIC_PATHS = ["/login"];
const PUBLIC_EXACT = ["/"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    if (isPublicPath(pathname)) return NextResponse.next();
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && token.role !== "operator") {
    // Rewrite to a path that matches no route so Next renders its normal
    // not-found page, mirroring requireOperator()'s notFound() behavior at
    // the page level.
    return NextResponse.rewrite(new URL("/__not_found__", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // All of /api/* is excluded, not just /api/auth/*: API routes authenticate
  // themselves (e.g. Task 13's /api/cron checks the CRON_SECRET header) and
  // must never be redirected to /login by this session-cookie check — that
  // would silently break the weekly scan cron. Page-level guards
  // (requireOperator/requirePracticeAccess) remain the real enforcement for
  // pages; this middleware is a redirect-to-login convenience plus the
  // /admin 404 check below.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
