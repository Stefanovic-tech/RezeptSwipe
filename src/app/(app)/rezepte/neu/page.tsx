import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import RecipeForm, { emptyRecipeForm } from "../RecipeForm";

export const dynamic = "force-dynamic";

export default async function NeuesRezeptPage() {
  const user = await requireUser();
  if (!user.currentHouseholdId) {
    redirect("/haushalt/einloesen");
  }
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link href="/rezepte" className="text-sm text-brand-600 dark:text-brand-300">
          &larr; Zurueck
        </Link>
        <h1 className="text-xl font-semibold">Neues Rezept</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Wird nur fuer Mitglieder deines aktuellen Haushalts sichtbar.
        </p>
      </header>
      <RecipeForm mode="create" initial={emptyRecipeForm} />
    </div>
  );
}
