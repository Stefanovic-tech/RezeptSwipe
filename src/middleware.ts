import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot",
  "/impressum",
  "/datenschutz",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/health") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname === "/manifest.json" || pathname === "/robots.txt") return true;
  return false;
}

function redirectToLogin(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

function redirectToRefresh(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/api/auth/refresh";
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

/** Damit Server Components die Ziel-URL kennen (Refresh-Redirect mit korrektem ?next=). */
function nextWithPathname(req: NextRequest): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return nextWithPathname(req);

  const access = req.cookies.get("rs_access")?.value;
  const refresh = req.cookies.get("rs_refresh")?.value;

  if (!access && !refresh) {
    return redirectToLogin(req, pathname);
  }

  if (access) {
    const claims = await verifyAccessToken(access);
    if (claims?.sub) return nextWithPathname(req);
  }

  if (refresh) {
    return redirectToRefresh(req, pathname);
  }

  return redirectToLogin(req, pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.json).*)",
  ],
};
