import { handle, jsonOk } from "@/lib/http";
import { getSessionUserAllowingRefresh } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await getSessionUserAllowingRefresh();
    return jsonOk({ user });
  });
}
