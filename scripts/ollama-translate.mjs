/**
 * Lokale Uebersetzung via Ollama (http://127.0.0.1:11434 oder OLLAMA_BASE_URL).
 *
 * Wichtig: Die Logik (Prompt, JSON-Schema, Ingredient-by-Index-Merge) muss
 * inhaltlich mit src/lib/recipe-translate.ts uebereinstimmen, damit Seed und
 * Lazy-Pfad identische Ergebnisse liefern.
 */

function defaultBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434")
    .trim()
    .replace(/\/+$/, "");
}

function defaultModel() {
  return (process.env.OLLAMA_MODEL || "").trim();
}

function defaultTimeoutMs() {
  const n = Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(n) && n >= 1000 ? Math.min(Math.floor(n), 600_000) : 120_000;
}

function parseJsonLoose(text) {
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

function buildPrompt(base) {
  return [
    "Translate this cooking recipe to natural German for app users in Germany.",
    "Return ONLY valid JSON (no markdown, no extra text).",
    "Keep short culinary terms. Preserve meaning and order.",
    'JSON schema: {"title_de":string,"category":string|null,"area":string|null,"tags":string|null,"ingredients":[{"name":string}],"steps":[string]}',
    "Input JSON:",
    JSON.stringify(base),
  ].join("\n");
}

/**
 * Uebersetzt ein Rezept (Form `{title_de, category, area, tags, ingredients, steps, ...}`)
 * ueber Ollama ins Deutsche. Liefert ein Objekt mit denselben Keys; bei Fehlern
 * wird `null` zurueckgegeben (Aufrufer entscheidet, ob Original beibehalten wird).
 */
export async function translateRecipeViaOllama(base) {
  const model = defaultModel();
  if (!model) return null;

  const url = `${defaultBaseUrl()}/api/chat`;
  const timeoutMs = defaultTimeoutMs();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        options: { temperature: 0.2 },
        messages: [
          {
            role: "system",
            content:
              "You translate cooking recipes to natural German. Output strict JSON matching the requested schema.",
          },
          { role: "user", content: buildPrompt(base) },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(
        `[ollama] HTTP ${res.status} (${model})${errText ? ` — ${errText.slice(0, 240)}` : ""}`
      );
      return null;
    }

    const data = await res.json().catch(() => null);
    const text = data?.message?.content ?? data?.response ?? "";
    const parsed = parseJsonLoose(text);
    if (!parsed || typeof parsed !== "object") {
      console.warn("[ollama] Kein parsebares JSON in der Antwort, nutze Originaltext.");
      return null;
    }

    const translatedIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    const translatedSteps = Array.isArray(parsed.steps) ? parsed.steps : [];

    const ingredients = base.ingredients.map((ing, idx) => {
      const name = translatedIngredients[idx]?.name;
      return {
        ...ing,
        name: typeof name === "string" && name.trim() ? name.trim() : ing.name,
      };
    });
    const steps = translatedSteps
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);

    return {
      ...base,
      title_de:
        typeof parsed.title_de === "string" && parsed.title_de.trim()
          ? parsed.title_de.trim()
          : base.title_de,
      category:
        typeof parsed.category === "string" && parsed.category.trim()
          ? parsed.category.trim()
          : base.category,
      area:
        typeof parsed.area === "string" && parsed.area.trim()
          ? parsed.area.trim()
          : base.area,
      tags:
        typeof parsed.tags === "string" && parsed.tags.trim()
          ? parsed.tags.trim()
          : base.tags,
      ingredients,
      steps: steps.length > 0 ? steps : base.steps,
    };
  } catch (e) {
    if (e?.name === "AbortError") {
      console.warn(`[ollama] Timeout nach ${timeoutMs}ms.`);
    } else {
      console.warn(`[ollama] Uebersetzung fehlgeschlagen: ${e?.message || e}`);
    }
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function ollamaConfigured() {
  return Boolean(defaultModel());
}
