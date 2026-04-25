import { cookies } from "next/headers";
import { handle, jsonOk } from "@/lib/http";
import { REFRESH_COOKIE, clearAuthCookies, revokeRefreshTokenByValue } from "@/lib/session";

export async function POST() {
  return handle(async () => {
    const refresh = cookies().get(REFRESH_COOKIE)?.value;
    if (refresh) await revokeRefreshTokenByValue(refresh);
    clearAuthCookies();
    return jsonOk({ ok: true });
  });
}
