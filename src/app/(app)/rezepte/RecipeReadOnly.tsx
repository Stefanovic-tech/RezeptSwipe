import type { RecipeDetail } from "@/lib/recipes";

function sourceLabel(source: string): string {
  if (source === "themealdb") return "TheMealDB";
  return source;
}

export default function RecipeReadOnly({
  recipe,
  source,
}: {
  recipe: RecipeDetail;
  source: string;
}) {
  return (
    <div className="space-y-8">
      {recipe.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.imageUrl}
          alt=""
          className="w-full max-h-80 rounded-xl object-cover bg-neutral-200 dark:bg-neutral-800"
        />
      ) : null}

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="badge">{sourceLabel(source)}</span>
        {recipe.category ? <span className="badge">{recipe.category}</span> : null}
        {recipe.area ? <span className="badge">{recipe.area}</span> : null}
        {recipe.estMinutes ? <span className="badge">~{recipe.estMinutes} Min.</span> : null}
        <span className="badge capitalize">{recipe.effort}</span>
        {recipe.isVegan ? <span className="badge bg-emerald-100 dark:bg-emerald-950">vegan</span> : null}
        {!recipe.isVegan && recipe.isVegetarian ? (
          <span className="badge bg-emerald-100 dark:bg-emerald-950">vegetarisch</span>
        ) : null}
        {recipe.hasPork ? <span className="badge">Schwein</span> : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Zutaten</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-sm">
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>
              {ing.amount != null && Number.isFinite(ing.amount) ? `${ing.amount} ` : null}
              {ing.unit ? `${ing.unit} ` : null}
              {ing.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Zubereitung</h2>
        <ol className="list-decimal pl-5 space-y-3 text-sm leading-relaxed">
          {recipe.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
