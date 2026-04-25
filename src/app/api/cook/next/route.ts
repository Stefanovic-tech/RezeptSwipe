import { NextRequest } from "next/server";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { getNextCandidate } from "@/lib/cooking";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ recipe: null });
    const sessionId = Number(req.nextUrl.searchParams.get("sessionId") ?? 0);
    if (!sessionId) return jsonOk({ recipe: null });
    const recipe = await getNextCandidate(user.currentHouseholdId, sessionId);
    return jsonOk({ recipe });
  });
}
