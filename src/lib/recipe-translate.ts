import { env } from "./env";
import { execute, queryOne, withTransaction, type RowDataPacket } from "./db";
import type { Ingredient } from "./recipes";

interface RecipeBase {
  title_de: string;
  title_orig: string | null;
  category: string | null;
  area: string | null;
  tags: string | null;
  ingredients: Ingredient[];
  steps: string[];
}

interface TranslatedRecipe extends RecipeBase {}

/**
 * Lockerer JSON-Parser: nimmt auch Markdown-Fences entgegen (`json ...`).
 * Identische Logik wie in scripts/ollama-translate.mjs — bewusst dupliziert,
 * weil der App-Server kein .mjs aus scripts importiert (siehe Plan).
 */
function parseJsonLoose(text: string): unknown {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

function buildPrompt(base: RecipeBase): string {
  return [
    "Translate this cooking recipe to natural German for app users in Germany.",
    "Return ONLY valid JSON (no markdown, no extra text).",
    "Keep short culinary terms. Preserve meaning and order.",
    'JSON schema: {"title_de":string,"category":string|null,"area":string|null,"tags":string|null,"ingredients":[{"name":string}],"steps":[string]}',
    "Input JSON:",
    JSON.stringify(base),
  ].join("\n");
}

export function ollamaConfigured(): boolean {
  return Boolean(env.ollama.model.trim());
}

function mapParsedToRecipe(base: RecipeBase, parsed: unknown): TranslatedRecipe | null {
  if (!parsed || typeof parsed !== "object") {
    console.warn("[ollama] Kein parsebares JSON in der Antwort, nutze Originaltext.");
    return null;
  }
  const p = parsed as {
    title_de?: unknown;
    category?: unknown;
    area?: unknown;
    tags?: unknown;
    ingredients?: unknown;
    steps?: unknown;
  };
  const translatedIngredients = Array.isArray(p.ingredients) ? p.ingredients : [];
  const translatedSteps = Array.isArray(p.steps) ? p.steps : [];
  const ingredients: Ingredient[] = base.ingredients.map((ing, idx) => {
    const cand = (translatedIngredients[idx] as { name?: unknown } | undefined)?.name;
    return {
      ...ing,
      name: typeof cand === "string" && cand.trim() ? cand.trim() : ing.name,
    };
  });
  const steps = translatedSteps
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  return {
    ...base,
    title_de:
      typeof p.title_de === "string" && p.title_de.trim() ? p.title_de.trim() : base.title_de,
    category:
      typeof p.category === "string" && p.category.trim() ? p.category.trim() : base.category,
    area: typeof p.area === "string" && p.area.trim() ? p.area.trim() : base.area,
    tags: typeof p.tags === "string" && p.tags.trim() ? p.tags.trim() : base.tags,
    ingredients,
    steps: steps.length > 0 ? steps : base.steps,
  };
}

type AttemptOutcome = { kind: "ok"; data: TranslatedRecipe } | { kind: "timeout" } | { kind: "fail" };

function ollamaChatOptions(numPredict: number): Record<string, number> {
  const opts: Record<string, number> = {
    temperature: 0.2,
    num_predict: Math.min(Math.max(numPredict, 256), 32_768),
  };
  const nt = env.ollama.numThread;
  if (nt > 0) {
    opts.num_thread = Math.min(Math.max(Math.floor(nt), 1), 64);
  }
  return opts;
}

async function translateRecipeViaOllamaOnce(
  base: RecipeBase,
  model: string,
  url: string,
  timeoutMs: number,
  numPredict: number
): Promise<AttemptOutcome> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const payload: Record<string, unknown> = {
      model,
      stream: false,
      options: ollamaChatOptions(numPredict),
      messages: [
        {
          role: "system",
          content:
            "You translate cooking recipes to natural German. Output strict JSON matching the requested schema.",
        },
        { role: "user", content: buildPrompt(base) },
      ],
    };
    if (env.ollama.jsonFormat) {
      payload.format = "json";
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(
        `[ollama] HTTP ${res.status} (${model})${errText ? ` — ${errText.slice(0, 240)}` : ""}`
      );
      return { kind: "fail" };
    }

    const data: { message?: { content?: string }; response?: string } | null = await res
      .json()
      .catch(() => null);
    const text = data?.message?.content ?? data?.response ?? "";
    const mapped = mapParsedToRecipe(base, parseJsonLoose(text));
    if (!mapped) return { kind: "fail" };
    return { kind: "ok", data: mapped };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err?.name === "AbortError") {
      console.warn(`[ollama] Timeout nach ${timeoutMs}ms.`);
      return { kind: "timeout" };
    }
    console.warn(`[ollama] Uebersetzung fehlgeschlagen: ${err?.message || e}`);
    return { kind: "fail" };
  } finally {
    clearTimeout(t);
  }
}

/** Eine Uebersetzung nach der anderen (weniger parallele CPU-Last). */
let ollamaQueueTail: Promise<unknown> = Promise.resolve();

function runOllamaExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const p = ollamaQueueTail.then(() => fn());
  ollamaQueueTail = p.catch(() => {});
  return p;
}

async function translateRecipeViaOllamaUnqueued(base: RecipeBase): Promise<TranslatedRecipe | null> {
  const model = env.ollama.model.trim();
  if (!model) return null;

  const baseUrl = env.ollama.baseUrl.trim().replace(/\/+$/, "");
  const url = `${baseUrl}/api/chat`;
  const timeoutBase = Math.min(Math.max(env.ollama.timeoutMs, 1000), 1_800_000);
  const numPredict = env.ollama.numPredict;

  const first = await translateRecipeViaOllamaOnce(base, model, url, timeoutBase, numPredict);
  if (first.kind === "ok") return first.data;
  if (first.kind === "timeout") {
    const retryMs = Math.min(timeoutBase + 120_000, 1_800_000);
    console.warn(`[ollama] zweiter Versuch (${retryMs}ms Timeout)...`);
    await new Promise((r) => setTimeout(r, 1500));
    const second = await translateRecipeViaOllamaOnce(base, model, url, retryMs, numPredict);
    if (second.kind === "ok") return second.data;
  }
  return null;
}

async function translateRecipeViaOllama(base: RecipeBase): Promise<TranslatedRecipe | null> {
  if (!env.ollama.serialize) {
    return translateRecipeViaOllamaUnqueued(base);
  }
  return runOllamaExclusive(() => translateRecipeViaOllamaUnqueued(base));
}

/**
 * Heuristik (Port aus scripts/mealdb-sync.mjs): Diet-Flags anhand der Zutaten-Namen.
 * Wird nach erfolgreicher Uebersetzung neu berechnet, damit Swipe-Filter
 * (vegetarisch / vegan / kein Schwein) auf den deutschen Begriffen funktionieren.
 */
function inferDietFlags(ingredientNames: string[]): {
  is_vegetarian: number;
  is_vegan: number;
  has_pork: number;
} {
  const blob = ingredientNames.join(" ").toLowerCase();
  const porkRe =
    /\b(pork|bacon|ham|prosciutto|chorizo|pancetta|speck|schwein|salami|sausage|andouille|guanciale|lard|lardo)\b/i;
  const meatFishRe =
    /\b(beef|chicken|lamb|duck|turkey|veal|venison|rabbit|goat|fish|salmon|tuna|cod|trout|mackerel|prawn|shrimp|crab|lobster|mussel|oyster|squid|octopus|anchovy|sardine|herring|steak|mince|ground meat|liver|kidney|oxtail|ribs|wing|breast|thigh|drumstick|gelatine|gelatin|stock cube|bouillon|fish sauce|wurst|huhn|rind|lachs|thunfisch|fleisch|seafood)\b/i;
  const dairyEggRe =
    /\b(milk|cream|butter|cheese|yogurt|yoghurt|egg|eggs|mozzarella|parmesan|cheddar|mascarpone|ricotta|ghee|buttermilk|mayonnaise|double cream|single cream|milch|sahne|butter|ei(er)?|kaese|quark|joghurt|mayo)\b/i;
  const honeyRe = /\b(honey|honig)\b/i;

  const hasPork = porkRe.test(blob) ? 1 : 0;
  const hasAnimal = meatFishRe.test(blob) || porkRe.test(blob) ? 1 : 0;
  const isVegetarian = hasAnimal ? 0 : 1;
  const isVegan = isVegetarian && !dairyEggRe.test(blob) && !honeyRe.test(blob) ? 1 : 0;
  return {
    is_vegetarian: isVegan ? 1 : isVegetarian,
    is_vegan: isVegan,
    has_pork: isVegan || isVegetarian ? 0 : hasPork,
  };
}

const TRANSLATE_LOCK_TTL_MS = 2 * 60 * 1000;

interface RecipeRowMinimal extends RowDataPacket {
  id: number;
  source: string;
  title_de: string;
  title_orig: string | null;
  category: string | null;
  area: string | null;
  tags: string | null;
  ingredients_json: string;
  steps_json: string;
  de_content_ready: number;
  de_translate_locked_at: string | null;
}

function parseIngredientsJson(json: unknown): Ingredient[] {
  try {
    const raw = typeof json === "string" ? json : JSON.stringify(json ?? []);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => ({
      name: String(p?.name ?? ""),
      amount:
        p?.amount === null || p?.amount === undefined || p?.amount === ""
          ? null
          : Number(p.amount),
      unit: p?.unit === null || p?.unit === undefined ? null : String(p.unit),
    }));
  } catch {
    return [];
  }
}

function parseStepsJson(json: unknown): string[] {
  try {
    const raw = typeof json === "string" ? json : JSON.stringify(json ?? []);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
    return [];
  } catch {
    return [];
  }
}

/**
 * Stellt sicher, dass ein TheMealDB-Rezept deutsche Inhalte hat. Wird beim
 * Oeffnen des Detail-Views und fuer die oberste Swipe-Karte aufgerufen. Andere
 * Quellen (z. B. `custom`) werden nicht angefasst.
 *
 * Schreibt nur dann, wenn Ollama eine plausible Antwort liefert. Bei Fehler
 * bleibt `de_content_ready=0` und ein erneuter Aufruf darf es spaeter nochmal
 * versuchen. Parallele Calls werden via `de_translate_locked_at` entkoppelt.
 */
export async function ensureThemealDbRecipeGerman(recipeId: number): Promise<boolean> {
  if (!ollamaConfigured()) return false;
  if (!Number.isInteger(recipeId) || recipeId <= 0) return false;

  const claim = await withTransaction(async (conn) => {
    const [rows] = await conn.query<RecipeRowMinimal[]>(
      `SELECT id, source, title_de, title_orig, category, area, tags,
              ingredients_json, steps_json, de_content_ready, de_translate_locked_at
         FROM recipe_cache
        WHERE id = ?
        FOR UPDATE`,
      [recipeId]
    );
    const row = rows[0];
    if (!row) return null;
    if (row.source !== "themealdb") return null;
    if (row.de_content_ready === 1) return null;

    if (row.de_translate_locked_at) {
      const lockedAtMs = new Date(row.de_translate_locked_at).getTime();
      if (Number.isFinite(lockedAtMs) && Date.now() - lockedAtMs < TRANSLATE_LOCK_TTL_MS) {
        return null;
      }
    }

    await conn.query(
      `UPDATE recipe_cache
          SET de_translate_locked_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [recipeId]
    );
    return row;
  });

  if (!claim) return false;

  const base: RecipeBase = {
    title_de: claim.title_de,
    title_orig: claim.title_orig,
    category: claim.category,
    area: claim.area,
    tags: claim.tags,
    ingredients: parseIngredientsJson(claim.ingredients_json),
    steps: parseStepsJson(claim.steps_json),
  };

  let translated: TranslatedRecipe | null = null;
  try {
    translated = await translateRecipeViaOllama(base);
  } catch (e) {
    console.warn(
      `[ensureThemealDbRecipeGerman] Uebersetzung fehlgeschlagen: ${(e as Error)?.message || e}`
    );
  }

  if (!translated) {
    await execute(
      `UPDATE recipe_cache SET de_translate_locked_at = NULL WHERE id = ?`,
      [recipeId]
    );
    return false;
  }

  const flags = inferDietFlags(translated.ingredients.map((i) => i.name));

  await execute(
    `UPDATE recipe_cache
        SET title_de = ?,
            category = ?,
            area = ?,
            tags = ?,
            ingredients_json = ?,
            steps_json = ?,
            is_vegetarian = ?,
            is_vegan = ?,
            has_pork = ?,
            de_content_ready = 1,
            de_translate_locked_at = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [
      translated.title_de,
      translated.category,
      translated.area,
      translated.tags,
      JSON.stringify(translated.ingredients),
      JSON.stringify(translated.steps),
      flags.is_vegetarian,
      flags.is_vegan,
      flags.has_pork,
      recipeId,
    ]
  );
  return true;
}

/**
 * Variante fuer die Swipe-Liste: Best-Effort. Fehler werden geschluckt und
 * geloggt, damit ein langsames/abwesendes Ollama nicht den Deck-Aufruf
 * blockiert.
 */
export async function ensureRecipeGermanBestEffort(
  recipeId: number | null | undefined
): Promise<boolean> {
  if (!recipeId) return false;
  try {
    return await ensureThemealDbRecipeGerman(recipeId);
  } catch (e) {
    console.warn(
      `[ensureRecipeGermanBestEffort] ignoriere Fehler fuer #${recipeId}: ${
        (e as Error)?.message || e
      }`
    );
    return false;
  }
}
