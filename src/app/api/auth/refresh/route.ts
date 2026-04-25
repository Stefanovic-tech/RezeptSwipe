import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, tryRefreshSessionCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

function safeNextPath(raw: string | null): string {
  if (!raw || typeof raw !== "string") return "/";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/";
  if (t.includes("@") || t.includes("\\")) return "/";
  if (t.length > 2048) return "/";
  return t;
}

/**
 * Setzt Access/Refresh neu (Cookie-Mutation nur hier im Route Handler).
 * Middleware leitet hierher, wenn das Access-JWT fehlt/abgelaufen ist.
 */
export async function GET(req: NextRequest) {
  const nextPath = safeNextPath(req.nextUrl.searchParams.get("next"));
  const user = await tryRefreshSessionCookies();
  if (!user) {
    clearAuthCookies();
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const target = new URL(nextPath, req.url);
  return NextResponse.redirect(target);
}
