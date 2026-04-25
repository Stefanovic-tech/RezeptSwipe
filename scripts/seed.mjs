import { createConnection } from "./_db.mjs";
import { loadEnv } from "./_env.mjs";

loadEnv();

/** Stabile Vorschaubilder fuer Seed-Rezepte (ohne externe API). */
function seedPreviewImage(externalId) {
  return `https://picsum.photos/seed/${encodeURIComponent(externalId)}/800/600`;
}

const FALLBACK_RECIPES = [
  {
    source: "seed",
    external_id: "tomatensuppe-001",
    title_de: "Klassische Tomatensuppe",
    title_orig: "Tomato Soup",
    image_url: null,
    category: "Suppe",
    area: "Deutsch",
    tags: "schnell,vegetarisch",
    is_vegetarian: 1,
    is_vegan: 0,
    has_pork: 0,
    effort: "quick",
    est_minutes: 25,
    ingredients: [
      { name: "Tomaten", amount: 1, unit: "kg" },
      { name: "Zwiebel", amount: 1, unit: "Stueck" },
      { name: "Knoblauch", amount: 2, unit: "Zehen" },
      { name: "Gemuesebruehe", amount: 500, unit: "ml" },
      { name: "Olivenoel", amount: 2, unit: "EL" },
      { name: "Salz", amount: null, unit: null },
      { name: "Pfeffer", amount: null, unit: null },
    ],
    steps: [
      "Zwiebel und Knoblauch fein wuerfeln und in Olivenoel glasig duensten.",
      "Tomaten zugeben und kurz mitduensten.",
      "Mit Gemuesebruehe aufgiessen und 15 Minuten koecheln.",
      "Pueriere die Suppe glatt und schmecke mit Salz und Pfeffer ab.",
    ],
  },
  {
    source: "seed",
    external_id: "spaghetti-aglio-002",
    title_de: "Spaghetti aglio e olio",
    title_orig: "Spaghetti Aglio e Olio",
    image_url: null,
    category: "Pasta",
    area: "Italienisch",
    tags: "schnell,vegan",
    is_vegetarian: 1,
    is_vegan: 1,
    has_pork: 0,
    effort: "quick",
    est_minutes: 20,
    ingredients: [
      { name: "Spaghetti", amount: 400, unit: "g" },
      { name: "Knoblauch", amount: 4, unit: "Zehen" },
      { name: "Olivenoel", amount: 6, unit: "EL" },
      { name: "Chiliflocken", amount: 1, unit: "TL" },
      { name: "Petersilie", amount: 1, unit: "Bund" },
      { name: "Salz", amount: null, unit: null },
    ],
    steps: [
      "Spaghetti in reichlich gesalzenem Wasser al dente kochen.",
      "Knoblauch in duenne Scheiben schneiden und in Olivenoel mit Chiliflocken sanft anbraten.",
      "Die abgegossenen Spaghetti im Knoblauch-Oel schwenken.",
      "Mit Petersilie bestreuen und sofort servieren.",
    ],
  },
  {
    source: "seed",
    external_id: "ofengemuese-003",
    title_de: "Buntes Ofengemuese mit Kraeuterquark",
    title_orig: null,
    image_url: null,
    category: "Hauptgericht",
    area: "Deutsch",
    tags: "vegetarisch",
    is_vegetarian: 1,
    is_vegan: 0,
    has_pork: 0,
    effort: "normal",
    est_minutes: 45,
    ingredients: [
      { name: "Karotten", amount: 300, unit: "g" },
      { name: "Zucchini", amount: 1, unit: "Stueck" },
      { name: "Paprika", amount: 2, unit: "Stueck" },
      { name: "Suesskartoffel", amount: 1, unit: "Stueck" },
      { name: "Olivenoel", amount: 3, unit: "EL" },
      { name: "Quark", amount: 250, unit: "g" },
      { name: "Schnittlauch", amount: 1, unit: "Bund" },
    ],
    steps: [
      "Gemuese waschen, putzen und in mundgerechte Stuecke schneiden.",
      "Auf einem Blech mit Olivenoel, Salz und Pfeffer mischen und bei 200 Grad ca. 30 Minuten backen.",
      "Quark mit Schnittlauch, Salz und Pfeffer ruehren.",
      "Ofengemuese mit Kraeuterquark servieren.",
    ],
  },
  {
    source: "seed",
    external_id: "linsendal-004",
    title_de: "Cremiges Linsen-Dal",
    title_orig: "Lentil Dal",
    image_url: null,
    category: "Hauptgericht",
    area: "Indisch",
    tags: "vegan",
    is_vegetarian: 1,
    is_vegan: 1,
    has_pork: 0,
    effort: "normal",
    est_minutes: 35,
    ingredients: [
      { name: "Rote Linsen", amount: 250, unit: "g" },
      { name: "Kokosmilch", amount: 400, unit: "ml" },
      { name: "Zwiebel", amount: 1, unit: "Stueck" },
      { name: "Knoblauch", amount: 2, unit: "Zehen" },
      { name: "Ingwer", amount: 1, unit: "Stueck" },
      { name: "Currypulver", amount: 2, unit: "TL" },
      { name: "Tomaten", amount: 2, unit: "Stueck" },
      { name: "Reis", amount: 250, unit: "g" },
    ],
    steps: [
      "Zwiebel, Knoblauch und Ingwer fein wuerfeln und in einem Topf andunsten.",
      "Curry zugeben, kurz roesten, dann Tomaten und Linsen zufuegen.",
      "Mit Wasser und Kokosmilch aufgiessen und 20 Minuten koecheln.",
      "Mit Reis servieren.",
    ],
  },
  {
    source: "seed",
    external_id: "haehnchen-curry-005",
    title_de: "Schnelles Haehnchen-Curry",
    title_orig: "Chicken Curry",
    image_url: null,
    category: "Hauptgericht",
    area: "Asiatisch",
    tags: "schnell",
    is_vegetarian: 0,
    is_vegan: 0,
    has_pork: 0,
    effort: "quick",
    est_minutes: 25,
    ingredients: [
      { name: "Haehnchenbrust", amount: 500, unit: "g" },
      { name: "Kokosmilch", amount: 400, unit: "ml" },
      { name: "Currypaste", amount: 2, unit: "EL" },
      { name: "Paprika", amount: 1, unit: "Stueck" },
      { name: "Zwiebel", amount: 1, unit: "Stueck" },
      { name: "Reis", amount: 250, unit: "g" },
    ],
    steps: [
      "Haehnchen in Streifen schneiden und scharf anbraten.",
      "Zwiebel und Paprika zufuegen und kurz mitbraten.",
      "Currypaste einruehren, mit Kokosmilch ablöschen und 10 Minuten koecheln.",
      "Mit Reis servieren.",
    ],
  },
  {
    source: "seed",
    external_id: "kartoffelgratin-006",
    title_de: "Kartoffelgratin",
    title_orig: null,
    image_url: null,
    category: "Hauptgericht",
    area: "Franzoesisch",
    tags: "aufwendig,vegetarisch",
    is_vegetarian: 1,
    is_vegan: 0,
    has_pork: 0,
    effort: "elaborate",
    est_minutes: 75,
    ingredients: [
      { name: "Kartoffeln", amount: 1, unit: "kg" },
      { name: "Sahne", amount: 400, unit: "ml" },
      { name: "Milch", amount: 200, unit: "ml" },
      { name: "Knoblauch", amount: 2, unit: "Zehen" },
      { name: "Reibekaese", amount: 150, unit: "g" },
      { name: "Muskat", amount: null, unit: null },
    ],
    steps: [
      "Kartoffeln schaelen und in duenne Scheiben hobeln.",
      "Sahne mit Milch, Knoblauch, Salz, Pfeffer und Muskat erhitzen.",
      "Kartoffeln einschichten, mit Sahnemischung uebergiessen, mit Kaese bestreuen.",
      "Bei 180 Grad ca. 60 Minuten goldbraun backen.",
    ],
  },
  {
    source: "seed",
    external_id: "salat-bowl-007",
    title_de: "Bunte Salat-Bowl mit Kichererbsen",
    title_orig: null,
    image_url: null,
    category: "Salat",
    area: "Mediterran",
    tags: "schnell,vegan",
    is_vegetarian: 1,
    is_vegan: 1,
    has_pork: 0,
    effort: "quick",
    est_minutes: 15,
    ingredients: [
      { name: "Kichererbsen", amount: 1, unit: "Dose" },
      { name: "Gurke", amount: 1, unit: "Stueck" },
      { name: "Tomaten", amount: 200, unit: "g" },
      { name: "Rote Zwiebel", amount: 1, unit: "Stueck" },
      { name: "Olivenoel", amount: 3, unit: "EL" },
      { name: "Zitrone", amount: 1, unit: "Stueck" },
      { name: "Petersilie", amount: 1, unit: "Bund" },
    ],
    steps: [
      "Kichererbsen abgiessen und abspuelen.",
      "Gemuese in Wuerfel schneiden.",
      "Mit Olivenoel, Zitronensaft, Salz und Pfeffer anmachen.",
      "Mit Petersilie bestreuen und servieren.",
    ],
  },
  {
    source: "seed",
    external_id: "gemuesepfanne-008",
    title_de: "Wok-Gemuesepfanne mit Tofu",
    title_orig: null,
    image_url: null,
    category: "Hauptgericht",
    area: "Asiatisch",
    tags: "schnell,vegan",
    is_vegetarian: 1,
    is_vegan: 1,
    has_pork: 0,
    effort: "quick",
    est_minutes: 25,
    ingredients: [
      { name: "Tofu", amount: 400, unit: "g" },
      { name: "Brokkoli", amount: 300, unit: "g" },
      { name: "Karotten", amount: 200, unit: "g" },
      { name: "Sojasauce", amount: 4, unit: "EL" },
      { name: "Sesamoel", amount: 2, unit: "EL" },
      { name: "Reis", amount: 250, unit: "g" },
      { name: "Ingwer", amount: 1, unit: "Stueck" },
    ],
    steps: [
      "Reis nach Packungsangabe kochen.",
      "Tofu in Wuerfeln scharf in Sesamoel anbraten.",
      "Gemuese zufuegen und unter Ruehren 5 Minuten braten.",
      "Mit Sojasauce und Ingwer wuerzen und mit Reis servieren.",
    ],
  },
];

async function ensureMinimumRecipes(conn, minCount) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS c FROM recipe_cache"
  );
  const have = Number(rows[0].c) || 0;
  if (have >= minCount) {
    console.log(
      `[seed] recipe_cache hat bereits ${have} Eintraege (min ${minCount}).`
    );
    return;
  }
  console.log(
    `[seed] fuelle recipe_cache mit Fallback-Rezepten auf (vorhanden: ${have}, min: ${minCount}).`
  );
  const sql = `
    INSERT INTO recipe_cache
      (source, external_id, title_de, title_orig, image_url, category, area, tags,
       is_vegetarian, is_vegan, has_pork, effort, est_minutes, ingredients_json, steps_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      image_url = VALUES(image_url),
      updated_at = CURRENT_TIMESTAMP
  `;
  for (const r of FALLBACK_RECIPES) {
    const imageUrl = r.image_url ?? seedPreviewImage(r.external_id);
    await conn.execute(sql, [
      r.source,
      r.external_id,
      r.title_de,
      r.title_orig,
      imageUrl,
      r.category,
      r.area,
      r.tags,
      r.is_vegetarian,
      r.is_vegan,
      r.has_pork,
      r.effort,
      r.est_minutes,
      JSON.stringify(r.ingredients),
      JSON.stringify(r.steps),
    ]);
  }
}

async function backfillSeedImages(conn) {
  for (const r of FALLBACK_RECIPES) {
    const imageUrl = r.image_url ?? seedPreviewImage(r.external_id);
    await conn.execute(
      `UPDATE recipe_cache SET image_url = ? WHERE source = ? AND external_id = ?`,
      [imageUrl, r.source, r.external_id]
    );
  }
  console.log("[seed] Vorschaubilder fuer Seed-Rezepte aktualisiert.");
}

async function main() {
  const min = Number(process.env.BOOTSTRAP_MIN_RECIPE_CACHE || 8);
  const conn = await createConnection();
  try {
    await ensureMinimumRecipes(conn, min);
    await backfillSeedImages(conn);
    console.log("[seed] fertig.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[seed] Fehler:", err.message);
  process.exit(1);
});
