import { execute, query, queryOne, type RowDataPacket } from "./db";
import { ensureMembership } from "./households";
import { ApiError } from "./session";

export interface Ingredient {
  name: string;
  amount: number | null;
  unit: string | null;
}

export interface RecipeRow {
  id: number;
  source: string;
  external_id: string;
  title_de: string;
  title_orig: string | null;
  image_url: string | null;
  category: string | null;
  area: string | null;
  tags: string | null;
  is_vegetarian: number;
  is_vegan: number;
  has_pork: number;
  effort: "quick" | "normal" | "elaborate";
  est_minutes: number | null;
  ingredients_json: string;
  steps_json: string;
}

interface RecipeWithStatusRow extends RecipeRow, RowDataPacket {
  status: "liked" | "passed" | null;
}

export interface RecipeListItem {
  id: number;
  title: string;
  imageUrl: string | null;
  category: string | null;
  area: string | null;
  effort: RecipeRow["effort"];
  estMinutes: number | null;
  isVegetarian: boolean;
  isVegan: boolean;
  hasPork: boolean;
}

export interface RecipeDetail extends RecipeListItem {
  ingredients: Ingredient[];
  steps: string[];
}

function parseIngredients(json: string): Ingredient[] {
  try {
    const parsed = JSON.parse(json);
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

function parseSteps(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.map(String);
    return [];
  } catch {
    return [];
  }
}

export function rowToListItem(row: RecipeRow): RecipeListItem {
  return {
    id: row.id,
    title: row.title_de,
    imageUrl: row.image_url,
    category: row.category,
    area: row.area,
    effort: row.effort,
    estMinutes: row.est_minutes,
    isVegetarian: row.is_vegetarian === 1,
    isVegan: row.is_vegan === 1,
    hasPork: row.has_pork === 1,
  };
}

export function rowToDetail(row: RecipeRow): RecipeDetail {
  return {
    ...rowToListItem(row),
    ingredients: parseIngredients(row.ingredients_json),
    steps: parseSteps(row.steps_json),
  };
}

export async function getRecipeDetail(recipeId: number): Promise<RecipeDetail | null> {
  const row = await queryOne<RecipeRow & RowDataPacket>(
    `SELECT id, source, external_id, title_de, title_orig, image_url, category, area, tags,
            is_vegetarian, is_vegan, has_pork, effort, est_minutes, ingredients_json, steps_json
     FROM recipe_cache WHERE id = ? LIMIT 1`,
    [recipeId]
  );
  if (!row) return null;
  return rowToDetail(row);
}

export interface SwipeFilters {
  vegetarian?: boolean;
  vegan?: boolean;
  noPork?: boolean;
}

export async function loadSwipeDeck(
  householdId: number,
  filters: SwipeFilters,
  limit = 20
): Promise<RecipeListItem[]> {
  const where: string[] = [
    "hrs.status IS NULL",
    "(r.household_id IS NULL OR r.household_id = ?)",
  ];
  const params: unknown[] = [householdId, householdId];
  if (filters.vegetarian) where.push("r.is_vegetarian = 1");
  if (filters.vegan) where.push("r.is_vegan = 1");
  if (filters.noPork) where.push("r.has_pork = 0");

  const rows = await query<RecipeWithStatusRow>(
    `SELECT r.id, r.source, r.external_id, r.title_de, r.title_orig, r.image_url, r.category,
            r.area, r.tags, r.is_vegetarian, r.is_vegan, r.has_pork, r.effort, r.est_minutes,
            r.ingredients_json, r.steps_json,
            hrs.status AS status
       FROM recipe_cache r
       LEFT JOIN household_recipe_state hrs
              ON hrs.recipe_id = r.id AND hrs.household_id = ?
      WHERE ${where.join(" AND ")}
      ORDER BY (r.household_id IS NULL) ASC, r.id ASC
      LIMIT ${Number(limit)}`,
    params
  );

  return rows.map(rowToListItem);
}

export async function setSwipeDecision(
  userId: number,
  householdId: number,
  recipeId: number,
  status: "liked" | "passed"
): Promise<void> {
  const recipe = await queryOne<RowDataPacket & { id: number }>(
    "SELECT id FROM recipe_cache WHERE id = ?",
    [recipeId]
  );
  if (!recipe) throw new ApiError(404, "Rezept nicht gefunden.");
  await execute(
    `INSERT INTO household_recipe_state (household_id, recipe_id, status, decided_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status),
                              decided_by = VALUES(decided_by),
                              decided_at = CURRENT_TIMESTAMP`,
    [householdId, recipeId, status, userId]
  );
}

export async function undoSwipeDecision(
  householdId: number,
  recipeId: number
): Promise<void> {
  await execute(
    "DELETE FROM household_recipe_state WHERE household_id = ? AND recipe_id = ?",
    [householdId, recipeId]
  );
}

/** Nur Entscheidungen zu globalen Rezepten (household_id IS NULL) loeschen. */
export async function resetGlobalSwipeDecisions(householdId: number): Promise<void> {
  await execute(
    `DELETE hrs FROM household_recipe_state hrs
      INNER JOIN recipe_cache r ON r.id = hrs.recipe_id
     WHERE hrs.household_id = ?
       AND r.household_id IS NULL`,
    [householdId]
  );
}

export async function countGlobalRecipes(): Promise<number> {
  const row = await queryOne<RowDataPacket & { c: number }>(
    "SELECT COUNT(*) AS c FROM recipe_cache WHERE household_id IS NULL",
    []
  );
  return Number(row?.c ?? 0);
}

export interface SwipeHistoryItem {
  recipeId: number;
  title: string;
  imageUrl: string | null;
  category: string | null;
  area: string | null;
  status: "liked" | "passed";
  decidedAt: string;
  decidedByUsername: string | null;
  isCustom: boolean;
}

export async function listSwipeHistory(
  userId: number,
  householdId: number,
  limit = 300
): Promise<SwipeHistoryItem[]> {
  await ensureMembership(userId, householdId);
  const cap = Math.min(Math.max(Number(limit) || 300, 1), 500);
  interface Row extends RowDataPacket {
    id: number;
    title_de: string;
    image_url: string | null;
    category: string | null;
    area: string | null;
    household_id_scope: number | null;
    status: "liked" | "passed";
    decided_at: Date | string;
    decided_by_username: string | null;
  }
  const rows = await query<Row>(
    `SELECT r.id, r.title_de, r.image_url, r.category, r.area,
            r.household_id AS household_id_scope,
            hrs.status, hrs.decided_at, u.username AS decided_by_username
       FROM household_recipe_state hrs
       JOIN recipe_cache r ON r.id = hrs.recipe_id
       LEFT JOIN users u ON u.id = hrs.decided_by
      WHERE hrs.household_id = ?
        AND (r.household_id IS NULL OR r.household_id = ?)
      ORDER BY hrs.decided_at DESC
      LIMIT ${cap}`,
    [householdId, householdId]
  );
  return rows.map((row) => ({
    recipeId: row.id,
    title: row.title_de,
    imageUrl: row.image_url,
    category: row.category,
    area: row.area,
    status: row.status,
    decidedAt:
      row.decided_at instanceof Date
        ? row.decided_at.toISOString()
        : String(row.decided_at),
    decidedByUsername: row.decided_by_username,
    isCustom: row.household_id_scope != null,
  }));
}

export async function listLikedRecipes(
  householdId: number,
  filters: { effort?: RecipeRow["effort"] | "any"; maxMinutes?: number | null } = {}
): Promise<RecipeListItem[]> {
  const where: string[] = [
    "hrs.household_id = ?",
    "hrs.status = 'liked'",
    "(r.household_id IS NULL OR r.household_id = ?)",
  ];
  const params: unknown[] = [householdId, householdId];
  if (filters.effort && filters.effort !== "any") {
    where.push("r.effort = ?");
    params.push(filters.effort);
  }
  if (filters.maxMinutes && filters.maxMinutes > 0) {
    where.push("(r.est_minutes IS NULL OR r.est_minutes <= ?)");
    params.push(filters.maxMinutes);
  }
  const rows = await query<RecipeRow & RowDataPacket>(
    `SELECT r.id, r.source, r.external_id, r.title_de, r.title_orig, r.image_url, r.category,
            r.area, r.tags, r.is_vegetarian, r.is_vegan, r.has_pork, r.effort, r.est_minutes,
            r.ingredients_json, r.steps_json
       FROM household_recipe_state hrs
       JOIN recipe_cache r ON r.id = hrs.recipe_id
      WHERE ${where.join(" AND ")}
      ORDER BY hrs.decided_at DESC`,
    params
  );
  return rows.map(rowToListItem);
}
