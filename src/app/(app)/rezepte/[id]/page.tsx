import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser, ApiError } from "@/lib/session";
import { getCustomRecipe } from "@/lib/custom-recipes";
import RecipeForm, { type RecipeFormValues } from "../RecipeForm";

export const dynamic = "force-dynamic";

export default async function RezeptDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user.currentHouseholdId) {
    redirect("/haushalt/einloesen");
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let recipe;
  try {
    recipe = await getCustomRecipe(user.id, user.currentHouseholdId, id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      notFound();
    }
    throw err;
  }

  const initial: RecipeFormValues = {
    title: recipe.title,
    imageUrl: recipe.imageUrl ?? "",
    category: recipe.category ?? "",
    area: recipe.area ?? "",
    effort: recipe.effort,
    estMinutes: recipe.estMinutes ? String(recipe.estMinutes) : "",
    isVegetarian: recipe.isVegetarian,
    isVegan: recipe.isVegan,
    hasPork: recipe.hasPork,
    ingredients:
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((i) => ({
            name: i.name,
            amount: i.amount === null || i.amount === undefined ? "" : String(i.amount),
            unit: i.unit ?? "",
          }))
        : [{ name: "", amount: "", unit: "" }],
    steps: recipe.steps.length > 0 ? recipe.steps : [""],
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link href="/rezepte" className="text-sm text-brand-600 dark:text-brand-300">
          &larr; Zurueck
        </Link>
        <h1 className="text-xl font-semibold">{recipe.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Hinzugefuegt von {recipe.createdByUsername ?? "-"}.
        </p>
      </header>
      <RecipeForm mode="edit" initial={initial} recipeId={recipe.id} />
    </div>
  );
}
