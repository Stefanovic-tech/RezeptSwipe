import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getPreferences } from "@/lib/households";
import { countGlobalRecipes, loadSwipeDeck } from "@/lib/recipes";
import { ensureRecipeGermanBestEffort } from "@/lib/recipe-translate";
import type { SwipeEmptyHint } from "./empty-hint";
import SwipeDeck from "./SwipeDeck";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function SwipePage() {
  const user = await requireUser();
  if (!user.currentHouseholdId) redirect("/haushalt/einloesen");

  const prefs = await getPreferences(user.currentHouseholdId);
  let initial = await loadSwipeDeck(
    user.currentHouseholdId,
    {
      vegetarian: prefs.vegetarian,
      vegan: prefs.vegan,
      noPork: prefs.no_pork,
    },
    20
  );

  if (initial[0]) {
    const updated = await ensureRecipeGermanBestEffort(initial[0].id);
    if (updated) {
      initial = await loadSwipeDeck(
        user.currentHouseholdId,
        {
          vegetarian: prefs.vegetarian,
          vegan: prefs.vegan,
          noPork: prefs.no_pork,
        },
        20
      );
    }
  }

  let emptyHint: SwipeEmptyHint = null;
  if (initial.length === 0) {
    const globals = await countGlobalRecipes();
    if (globals === 0) {
      emptyHint = "no_seed";
    } else {
      const relaxed = await loadSwipeDeck(
        user.currentHouseholdId,
        { vegetarian: false, vegan: false, noPork: false },
        1
      );
      emptyHint = relaxed.length > 0 ? "filters" : "all_swiped";
    }
  }

  return (
    <section className="py-2">
      <h1 className="text-xl font-semibold mb-2">Was darf es heute werden?</h1>
      <p className="text-sm text-neutral-500 mb-3">
        Rechts wischen oder Daumen hoch fuer ja. Links oder Daumen runter fuer nein.
      </p>
      <SwipeDeck initialDeck={initial} initialPrefs={prefs} emptyHint={emptyHint} />
    </section>
  );
}
