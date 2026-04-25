import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { ApiError } from "./session";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, error: { message, code } }, { status });
}

/** Erste vertrauenswuerdige Client-IP (Cloudflare setzt CF-Connecting-IP am Origin). */
export function getClientIp(): string | null {
  const cf = headers().get("cf-connecting-ip");
  if (cf?.trim()) return cf.trim();
  const xff = headers().get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers().get("x-real-ip");
}

export function getUserAgent(): string | null {
  return headers().get("user-agent");
}

export async function handle<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonError(err.message, err.status);
    }
    if (err instanceof ZodError) {
      const message = err.issues.map((i) => i.message).join(", ");
      return jsonError(message || "Ungueltige Eingabe.", 400, "validation");
    }
    if (err instanceof Error) {
      console.error("[api] error:", err);
      return jsonError(err.message || "Serverfehler.", 500);
    }
    console.error("[api] unknown error:", err);
    return jsonError("Serverfehler.", 500);
  }
}
