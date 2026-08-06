import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Deliberately does NOT import "@/lib/auth", because that module wires up the
// Drizzle adapter, Resend, and Credentials providers, which is more than
// middleware (edge runtime) needs to carry. Decoding the JWT session cookie
// via `getToken` only needs AUTH_SECRET, keeping this dependency-light.

// "/" is the public marketing page. It is matched exactly below rather than by
// the startsWith() prefix rule, since `"/".startsWith("/")` is true for every path
// on the site, so treating it as a prefix would make the entire app public.
// "/book" is the audit-request form the marketing page's CTAs point at. Every
// visitor who reaches it is by definition signed out, so omitting it here would
// redirect the entire inbound funnel to /login.
const PUBLIC_PATHS = ["/login", "/book"];
const PUBLIC_EXACT = ["/"];

// Files in /public are served straight off the path, e.g. /mirror-wordmark.png,
// and the matcher below only exempts _next/*. Without this they get redirected
// to /login for signed-out visitors, which breaks the marketing page's logo:
// the image optimizer refetches the source through the server and rejects the
// 307 with "the requested resource isn't a valid image". Page-level guards are
// the real enforcement (see the matcher note), so exempting static files here
// costs no protection.
const STATIC_FILE = /\.(?:png|jpe?g|svg|webp|avif|gif|ico|mp4|webm|mov|mp3|txt|xml|woff2?)$/;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  if (STATIC_FILE.test(pathname)) return true;
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

  // A user holding a temporary password sees nothing else until they've chosen
  // their own. The flag is stamped into the token at sign-in, so this costs no
  // database read in the edge runtime. `/change-password` itself is exempt for
  // the obvious reason; /api/* is already outside the matcher, which is what
  // lets the sign-out POST through.
  if (token.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.url));
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
  // must never be redirected to /login by this session-cookie check, because that
  // would silently break the weekly scan cron. Page-level guards
  // (requireOperator/requirePracticeAccess) remain the real enforcement for
  // pages; this middleware is a redirect-to-login convenience plus the
  // /admin 404 check below.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
