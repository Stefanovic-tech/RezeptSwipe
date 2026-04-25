import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { listCustomRecipes } from "@/lib/custom-recipes";
import { listSwipeHistory } from "@/lib/recipes";

export const dynamic = "force-dynamic";

function formatDecidedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export default async function RezepteListPage() {
  const user = await requireUser();
  if (!user.currentHouseholdId) {
    redirect("/haushalt/einloesen");
  }
  const hid = user.currentHouseholdId;
  const [swipeHistory, recipes] = await Promise.all([
    listSwipeHistory(user.id, hid, 400),
    listCustomRecipes(user.id, hid),
  ]);

  return (
    <div className="space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Rezepte</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Swipe-Historie deines Haushalts und eigene Rezepte zum Bearbeiten.
          </p>
        </div>
        <Link href="/rezepte/neu" className="btn btn-primary shrink-0 self-start sm:self-auto">
          + Eigenes Rezept
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Swipe-Historie</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Alle Rezepte, fuer die in diesem Haushalt schon <strong>Ja</strong> oder <strong>Nein</strong> gewaehlt
          wurde – zuletzt zuerst.
        </p>
        {swipeHistory.length === 0 ? (
          <div className="card p-5 text-sm text-neutral-600 dark:text-neutral-300">
            Noch keine Swipe-Entscheidungen. Unter <Link href="/swipe" className="text-brand-600 dark:text-brand-300">Swipe</Link>{" "}
            kannst du Vorschlaege bewerten.
          </div>
        ) : (
          <ul className="space-y-2">
            {swipeHistory.map((h) => (
              <li key={h.recipeId} className="card overflow-hidden">
                <div className="flex gap-3 p-3">
                  <div className="relative w-24 shrink-0 aspect-square rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                    {h.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={h.imageUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-white/90 font-semibold">
                        {h.title.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {h.isCustom ? (
                        <Link
                          href={`/rezepte/${h.recipeId}`}
                          className="font-semibold leading-tight text-brand-600 dark:text-brand-300 hover:underline"
                        >
                          {h.title}
                        </Link>
                      ) : (
                        <span className="font-semibold leading-tight">{h.title}</span>
                      )}
                      <span
                        className={
                          h.status === "liked"
                            ? "badge bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
                            : "badge bg-neutral-300 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100"
                        }
                      >
                        {h.status === "liked" ? "Gemerkt" : "Verworfen"}
                      </span>
                      {h.isCustom ? (
                        <span className="badge text-[10px]">eigenes Rezept</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-neutral-500">
                      {formatDecidedAt(h.decidedAt)}
                      {h.decidedByUsername ? ` · ${h.decidedByUsername}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {h.category ? <span className="badge">{h.category}</span> : null}
                      {h.area ? <span className="badge">{h.area}</span> : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Eigene Rezepte</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Nur in deinem Haushalt sichtbar; werden automatisch als gemerkt angelegt.
        </p>
        {recipes.length === 0 ? (
          <div className="card p-6 text-center space-y-3">
            <p className="text-neutral-600 dark:text-neutral-300">
              Noch keine eigenen Rezepte. Lege jetzt dein erstes an.
            </p>
            <Link href="/rezepte/neu" className="btn btn-primary inline-block">
              Erstes Rezept anlegen
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recipes.map((r) => (
              <li key={r.id} className="card overflow-hidden">
                <Link href={`/rezepte/${r.id}`} className="block">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="w-full aspect-video object-cover bg-neutral-200 dark:bg-neutral-800"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-brand-100 to-brand-300 dark:from-brand-900 dark:to-brand-700 flex items-center justify-center text-3xl font-semibold text-white/80">
                      {r.title.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{r.title}</h3>
                      {r.liked ? (
                        <span className="badge bg-emerald-200 dark:bg-emerald-900">gemerkt</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {r.category ? <span className="badge">{r.category}</span> : null}
                      {r.area ? <span className="badge">{r.area}</span> : null}
                      {r.estMinutes ? <span className="badge">~{r.estMinutes} Min.</span> : null}
                      <span className="badge capitalize">{r.effort}</span>
                      {r.isVegan ? <span className="badge bg-emerald-100 dark:bg-emerald-950">vegan</span> : null}
                      {!r.isVegan && r.isVegetarian ? (
                        <span className="badge bg-emerald-100 dark:bg-emerald-950">vegetarisch</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-neutral-500">
                      Hinzugefuegt von {r.createdByUsername ?? "-"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
