import { NextRequest } from "next/server";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { ensureMembership } from "@/lib/households";
import { loadSwipeDeck } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) {
      return jsonOk({ deck: [] });
    }
    await ensureMembership(user.id, user.currentHouseholdId);
    const params = req.nextUrl.searchParams;
    const deck = await loadSwipeDeck(
      user.currentHouseholdId,
      {
        vegetarian: params.get("vegetarian") === "1",
        vegan: params.get("vegan") === "1",
        noPork: params.get("noPork") === "1",
      },
      Number(params.get("limit") ?? 20)
    );
    return jsonOk({ deck });
  });
}
