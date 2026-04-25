/**
 * Laedt Rezepte von TheMealDB (https://www.themealdb.com/) und schreibt sie in recipe_cache.
 * Nutzt random.php (kein API-Key). Wird von seed.mjs aufgerufen.
 */

const SOURCE = "themealdb";

function baseUrl() {
  const u = (process.env.THEMEALDB_BASE_URL || "https://www.themealdb.com/api/json/v1/1")
    .trim()
    .replace(/\/+$/, "");
  return u;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseJsonLoose(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Gemini liefert gelegentlich Markdown-Fences.
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

async function translateMealToGerman(base) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return base;
  const model = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = [
    "Translate this cooking recipe to natural German for app users in Germany.",
    "Return ONLY valid JSON (no markdown, no extra text).",
    "Keep short culinary terms. Preserve meaning and order.",
    'JSON schema: {"title_de":string,"category":string|null,"area":string|null,"tags":string|null,"ingredients":[{"name":string}],"steps":[string]}',
    "Input JSON:",
    JSON.stringify(base),
  ].join("\n");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });
    if (!res.ok) return base;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = parseJsonLoose(text);
    if (!parsed || typeof parsed !== "object") return base;

    const translatedIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    const translatedSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const ingredientNames = base.ingredients.map((ing, idx) => {
      const n = translatedIngredients[idx]?.name;
      return typeof n === "string" && n.trim() ? n.trim() : ing.name;
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
      ingredients: base.ingredients.map((ing, idx) => ({ ...ing, name: ingredientNames[idx] || ing.name })),
      steps: steps.length > 0 ? steps : base.steps,
    };
  } catch {
    return base;
  }
}

/** Grobe Erkennung fuer Swipe-Filter (Zutaten meist Englisch). */
function inferDietFlags(ingredientNames) {
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
  const isVegan =
    isVegetarian && !dairyEggRe.test(blob) && !honeyRe.test(blob) ? 1 : 0;
  return {
    is_vegetarian: isVegan ? 1 : isVegetarian,
    is_vegan: isVegan,
    has_pork: isVegan || isVegetarian ? 0 : hasPork,
  };
}

function effortFromText(text) {
  const t = (text || "").length;
  if (t > 1400) return "elaborate";
  if (t > 450) return "normal";
  return "quick";
}

function parseSteps(strInstructions) {
  if (!strInstructions || typeof strInstructions !== "string") return ["Nach Lust und Laune zubereiten."];
  const parts = strInstructions
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return ["Nach Lust und Laune zubereiten."];
  return parts.slice(0, 40);
}

function parseIngredients(m) {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const name = m[`strIngredient${i}`];
    const measure = m[`strMeasure${i}`];
    if (!name || !String(name).trim()) continue;
    const n = String(name).trim();
    const rawM = measure != null ? String(measure).trim() : "";
    let amount = null;
    let unit = null;
    if (rawM) {
      const numMatch = rawM.match(/^([\d.,/]+)\s*(.*)$/);
      if (numMatch) {
        const numStr = numMatch[1].replace(",", ".");
        const frac = numStr.split("/");
        if (frac.length === 2) {
          const a = Number(frac[0]);
          const b = Number(frac[1]);
          amount = b ? a / b : null;
        } else {
          amount = Number(numStr);
          if (!Number.isFinite(amount)) amount = null;
        }
        unit = numMatch[2].trim() || null;
      } else {
        unit = rawM;
      }
    }
    out.push({ name: n, amount, unit });
  }
  if (out.length === 0) {
    out.push({ name: "Zutaten laut TheMealDB", amount: null, unit: null });
  }
  return out;
}

async function mapMealToRow(m) {
  const ingredients = parseIngredients(m);
  const names = ingredients.map((x) => x.name);
  const flags = inferDietFlags(names);
  const steps = parseSteps(m.strInstructions);
  const title = (m.strMeal && String(m.strMeal).trim()) || "Unbenannt";
  const externalId = String(m.idMeal || "").trim();
  if (!externalId) return null;

  const base = {
    source: SOURCE,
    external_id: externalId,
    title_de: title,
    title_orig: title,
    image_url: m.strMealThumb || null,
    category: m.strCategory || null,
    area: m.strArea || null,
    tags: m.strTags || null,
    is_vegetarian: flags.is_vegetarian,
    is_vegan: flags.is_vegan,
    has_pork: flags.has_pork,
    effort: effortFromText(m.strInstructions),
    est_minutes: null,
    ingredients,
    steps,
  };
  const translated = await translateMealToGerman(base);
  return translated;
}

async function fetchRandomMeal() {
  const url = `${baseUrl()}/random.php`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`TheMealDB HTTP ${res.status}`);
  const data = await res.json();
  const meal = data?.meals?.[0];
  return meal || null;
}

const INSERT_SQL = `
  INSERT INTO recipe_cache
    (source, external_id, title_de, title_orig, image_url, category, area, tags,
     is_vegetarian, is_vegan, has_pork, effort, est_minutes, ingredients_json, steps_json, raw_payload)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    title_de = VALUES(title_de),
    title_orig = VALUES(title_orig),
    image_url = VALUES(image_url),
    category = VALUES(category),
    area = VALUES(area),
    tags = VALUES(tags),
    is_vegetarian = VALUES(is_vegetarian),
    is_vegan = VALUES(is_vegan),
    has_pork = VALUES(has_pork),
    effort = VALUES(effort),
    est_minutes = VALUES(est_minutes),
    ingredients_json = VALUES(ingredients_json),
    steps_json = VALUES(steps_json),
    raw_payload = VALUES(raw_payload),
    updated_at = CURRENT_TIMESTAMP
`;

/**
 * @param {import("mysql2/promise").Connection} conn
 * @param {{ count: number; delayMs?: number }} opts
 */
export async function syncMealDbRandomRecipes(conn, opts) {
  const count = Math.max(0, Math.min(Number(opts.count) || 0, 80));
  const delayMs = Number(opts.delayMs) >= 0 ? Number(opts.delayMs) : 150;
  if (count === 0) {
    console.log("[mealdb] MEALDB_RANDOM_PER_RUN=0, ueberspringe TheMealDB.");
    return { inserted: 0, skipped: 0, errors: 0 };
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < count; i++) {
    try {
      const meal = await fetchRandomMeal();
      if (!meal) {
        skipped++;
        continue;
      }
      const row = await mapMealToRow(meal);
      if (!row) {
        skipped++;
        continue;
      }
      await conn.execute(INSERT_SQL, [
        row.source,
        row.external_id,
        row.title_de,
        row.title_orig,
        row.image_url,
        row.category,
        row.area,
        row.tags,
        row.is_vegetarian,
        row.is_vegan,
        row.has_pork,
        row.effort,
        row.est_minutes,
        JSON.stringify(row.ingredients),
        JSON.stringify(row.steps),
        JSON.stringify({ idMeal: meal.idMeal, strMeal: meal.strMeal }),
      ]);
      inserted++;
    } catch (e) {
      errors++;
      console.warn(`[mealdb] Abruf ${i + 1}/${count}: ${e.message}`);
    }
    if (delayMs > 0 && i < count - 1) await sleep(delayMs);
  }

  console.log(
    `[mealdb] TheMealDB: ${inserted} upsert(s), ${skipped} leer, ${errors} Fehler (Zielabrufe: ${count}).`
  );
  return { inserted, skipped, errors };
}
