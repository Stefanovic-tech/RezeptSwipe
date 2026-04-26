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
  const n = Number(process.env.OLLAMA_TIMEOUT_MS ?? 300_000);
  return Number.isFinite(n) && n >= 1000 ? Math.min(Math.floor(n), 600_000) : 300_000;
}

function defaultNumPredict() {
  const n = Number(process.env.OLLAMA_NUM_PREDICT ?? 6144);
  return Number.isFinite(n) && n >= 256 ? Math.min(Math.floor(n), 32768) : 6144;
}

function defaultNumThread() {
  const n = Number(process.env.OLLAMA_NUM_THREAD ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.floor(n), 1), 64) : 0;
}

function ollamaChatOptions(numPredict) {
  const opts = {
    temperature: 0.2,
    num_predict: numPredict,
  };
  const nt = defaultNumThread();
  if (nt > 0) opts.num_thread = nt;
  return opts;
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
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateRecipeViaOllamaOnce(base, model, url, timeoutMs, numPredict) {
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
        options: ollamaChatOptions(numPredict),
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
      return { kind: "fail" };
    }

    const data = await res.json().catch(() => null);
    const text = data?.message?.content ?? data?.response ?? "";
    const parsed = parseJsonLoose(text);
    if (!parsed || typeof parsed !== "object") {
      console.warn("[ollama] Kein parsebares JSON in der Antwort, nutze Originaltext.");
      return { kind: "fail" };
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
      kind: "ok",
      data: {
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
      },
    };
  } catch (e) {
    if (e?.name === "AbortError") {
      console.warn(`[ollama] Timeout nach ${timeoutMs}ms.`);
      return { kind: "timeout" };
    }
    console.warn(`[ollama] Uebersetzung fehlgeschlagen: ${e?.message || e}`);
    return { kind: "fail" };
  } finally {
    clearTimeout(t);
  }
}

export async function translateRecipeViaOllama(base) {
  const model = defaultModel();
  if (!model) return null;

  const url = `${defaultBaseUrl()}/api/chat`;
  const timeoutBase = defaultTimeoutMs();
  const numPredict = defaultNumPredict();

  const first = await translateRecipeViaOllamaOnce(base, model, url, timeoutBase, numPredict);
  if (first.kind === "ok") return first.data;
  if (first.kind === "timeout") {
    const retryMs = Math.min(timeoutBase + 120_000, 600_000);
    console.warn(`[ollama] zweiter Versuch (${retryMs}ms Timeout)...`);
    await sleep(1500);
    const second = await translateRecipeViaOllamaOnce(base, model, url, retryMs, numPredict);
    if (second.kind === "ok") return second.data;
  }
  return null;
}

export function ollamaConfigured() {
  return Boolean(defaultModel());
}
