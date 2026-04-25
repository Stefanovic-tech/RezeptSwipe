import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getActiveCookingSession } from "@/lib/cooking";
import { listLikedRecipes } from "@/lib/recipes";
import CookingClient from "./CookingClient";

export const dynamic = "force-dynamic";

export default async function CookingPage() {
  const user = await requireUser();
  if (!user.currentHouseholdId) redirect("/haushalt/einloesen");
  const session = await getActiveCookingSession(user.currentHouseholdId);
  const likedCount = (await listLikedRecipes(user.currentHouseholdId)).length;
  return (
    <section className="py-2">
      <h1 className="text-xl font-semibold mb-2">Kochen</h1>
      <p className="text-sm text-neutral-500 mb-3">
        Aus deinen gemerkten Rezepten ein passendes auswaehlen.
      </p>
      <CookingClient initialSession={session} likedCount={likedCount} />
    </section>
  );
}
