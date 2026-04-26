import { NextRequest } from "next/server";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { ensureMembership } from "@/lib/households";
import { loadSwipeDeck } from "@/lib/recipes";
import { ensureRecipeGermanBestEffort } from "@/lib/recipe-translate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) {
      return jsonOk({ deck: [] });
    }
    await ensureMembership(user.id, user.currentHouseholdId);
    const params = req.nextUrl.searchParams;
    const filters = {
      vegetarian: params.get("vegetarian") === "1",
      vegan: params.get("vegan") === "1",
      noPork: params.get("noPork") === "1",
    };
    const limit = Number(params.get("limit") ?? 20);
    let deck = await loadSwipeDeck(user.currentHouseholdId, filters, limit);
    if (deck[0]) {
      const updated = await ensureRecipeGermanBestEffort(deck[0].id);
      if (updated) {
        deck = await loadSwipeDeck(user.currentHouseholdId, filters, limit);
      }
    }
    return jsonOk({ deck });
  });
}
