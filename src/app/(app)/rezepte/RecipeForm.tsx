"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type RecipeFormValues = {
  title: string;
  imageUrl: string;
  category: string;
  area: string;
  effort: "quick" | "normal" | "elaborate";
  estMinutes: string;
  isVegetarian: boolean;
  isVegan: boolean;
  hasPork: boolean;
  ingredients: { name: string; amount: string; unit: string }[];
  steps: string[];
};

export const emptyRecipeForm: RecipeFormValues = {
  title: "",
  imageUrl: "",
  category: "",
  area: "",
  effort: "normal",
  estMinutes: "",
  isVegetarian: false,
  isVegan: false,
  hasPork: false,
  ingredients: [{ name: "", amount: "", unit: "" }],
  steps: [""],
};

interface Props {
  mode: "create" | "edit";
  initial: RecipeFormValues;
  recipeId?: number;
  canDelete?: boolean;
}

function toApiPayload(values: RecipeFormValues) {
  const ingredients = values.ingredients
    .filter((i) => i.name.trim().length > 0)
    .map((i) => ({
      name: i.name.trim(),
      amount: i.amount.trim() === "" ? null : Number(i.amount.replace(",", ".")),
      unit: i.unit.trim() === "" ? null : i.unit.trim(),
    }));

  const steps = values.steps.map((s) => s.trim()).filter((s) => s.length > 0);

  return {
    title: values.title.trim(),
    imageUrl: values.imageUrl.trim(),
    category: values.category.trim(),
    area: values.area.trim(),
    effort: values.effort,
    estMinutes:
      values.estMinutes.trim() === "" ? null : Number(values.estMinutes.replace(",", ".")),
    isVegetarian: values.isVegetarian || values.isVegan,
    isVegan: values.isVegan,
    hasPork: values.hasPork && !(values.isVegetarian || values.isVegan),
    ingredients,
    steps,
  };
}

export default function RecipeForm({ mode, initial, recipeId, canDelete = true }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<RecipeFormValues>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setIngredient(idx: number, patch: Partial<RecipeFormValues["ingredients"][number]>) {
    setValues((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i, j) => (j === idx ? { ...i, ...patch } : i)),
    }));
  }

  function addIngredient() {
    setValues((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: "", amount: "", unit: "" }],
    }));
  }

  function removeIngredient(idx: number) {
    setValues((prev) => ({
      ...prev,
      ingredients:
        prev.ingredients.length > 1
          ? prev.ingredients.filter((_, j) => j !== idx)
          : prev.ingredients,
    }));
  }

  function setStep(idx: number, value: string) {
    setValues((prev) => ({
      ...prev,
      steps: prev.steps.map((s, j) => (j === idx ? value : s)),
    }));
  }

  function addStep() {
    setValues((prev) => ({ ...prev, steps: [...prev.steps, ""] }));
  }

  function removeStep(idx: number) {
    setValues((prev) => ({
      ...prev,
      steps: prev.steps.length > 1 ? prev.steps.filter((_, j) => j !== idx) : prev.steps,
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = toApiPayload(values);
      const url = mode === "create" ? "/api/recipes" : `/api/recipes/${recipeId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Speichern fehlgeschlagen.");
      }
      router.push("/rezepte");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!recipeId) return;
    if (!confirm("Dieses Rezept wirklich loeschen?")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Loeschen fehlgeschlagen.");
      }
      router.push("/rezepte");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Loeschen.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Allgemein</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Titel *</span>
          <input
            className="input"
            required
            maxLength={255}
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="z.B. Mamas Lasagne"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Bild-URL</span>
          <input
            type="url"
            inputMode="url"
            className="input"
            value={values.imageUrl}
            onChange={(e) => update("imageUrl", e.target.value)}
            placeholder="https://..."
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Kategorie</span>
            <input
              className="input"
              maxLength={80}
              value={values.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="Pasta, Suppe, ..."
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Region</span>
            <input
              className="input"
              maxLength={80}
              value={values.area}
              onChange={(e) => update("area", e.target.value)}
              placeholder="Italienisch, ..."
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Aufwand</span>
            <select
              className="input"
              value={values.effort}
              onChange={(e) =>
                update("effort", e.target.value as RecipeFormValues["effort"])
              }
            >
              <option value="quick">Schnell</option>
              <option value="normal">Normal</option>
              <option value="elaborate">Aufwendig</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Zeit (Min.)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              className="input"
              value={values.estMinutes}
              onChange={(e) => update("estMinutes", e.target.value)}
              placeholder="30"
            />
          </label>
        </div>
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 text-neutral-600 dark:text-neutral-300">Eigenschaften</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={values.isVegetarian}
              onChange={(e) => update("isVegetarian", e.target.checked)}
            />
            Vegetarisch
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={values.isVegan}
              onChange={(e) => {
                const checked = e.target.checked;
                setValues((prev) => ({
                  ...prev,
                  isVegan: checked,
                  isVegetarian: checked ? true : prev.isVegetarian,
                  hasPork: checked ? false : prev.hasPork,
                }));
              }}
            />
            Vegan
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={values.hasPork}
              disabled={values.isVegetarian || values.isVegan}
              onChange={(e) => update("hasPork", e.target.checked)}
            />
            Enthaelt Schweinefleisch
          </label>
        </fieldset>
      </section>

      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Zutaten</h2>
          <button type="button" onClick={addIngredient} className="btn btn-secondary text-sm px-3">
            + Zutat
          </button>
        </div>
        <ul className="space-y-3">
          {values.ingredients.map((ing, idx) => (
            <li key={idx} className="grid grid-cols-12 gap-2 items-start">
              <input
                className="input col-span-12 sm:col-span-6"
                placeholder="Zutat (z.B. Hackfleisch)"
                value={ing.name}
                onChange={(e) => setIngredient(idx, { name: e.target.value })}
              />
              <input
                className="input col-span-5 sm:col-span-2"
                inputMode="decimal"
                placeholder="Menge"
                value={ing.amount}
                onChange={(e) => setIngredient(idx, { amount: e.target.value })}
              />
              <input
                className="input col-span-4 sm:col-span-3"
                placeholder="Einheit"
                value={ing.unit}
                onChange={(e) => setIngredient(idx, { unit: e.target.value })}
              />
              <button
                type="button"
                aria-label="Zutat entfernen"
                onClick={() => removeIngredient(idx)}
                className="btn btn-secondary col-span-3 sm:col-span-1"
                disabled={values.ingredients.length === 1}
              >
                X
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Schritte</h2>
          <button type="button" onClick={addStep} className="btn btn-secondary text-sm px-3">
            + Schritt
          </button>
        </div>
        <ol className="space-y-3 list-decimal pl-6">
          {values.steps.map((step, idx) => (
            <li key={idx}>
              <div className="flex gap-2 items-start">
                <textarea
                  className="input min-h-[88px] flex-1"
                  placeholder={`Schritt ${idx + 1}`}
                  value={step}
                  onChange={(e) => setStep(idx, e.target.value)}
                />
                <button
                  type="button"
                  aria-label="Schritt entfernen"
                  onClick={() => removeStep(idx)}
                  className="btn btn-secondary"
                  disabled={values.steps.length === 1}
                >
                  X
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {error ? (
        <div className="card p-3 text-sm text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-200 border-rose-200 dark:border-rose-900">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 sticky bottom-16 sm:static z-10">
        <button type="submit" disabled={submitting} className="btn btn-primary flex-1 sm:flex-none">
          {submitting
            ? "Speichere..."
            : mode === "create"
            ? "Rezept erstellen"
            : "Aenderungen speichern"}
        </button>
        {mode === "edit" && canDelete ? (
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="btn btn-danger"
          >
            {deleting ? "Loesche..." : "Loeschen"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => router.push("/rezepte")}
          className="btn btn-secondary"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
