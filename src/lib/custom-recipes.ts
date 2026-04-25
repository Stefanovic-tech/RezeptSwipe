import { randomBytes } from "node:crypto";
import { z } from "zod";
import { query, queryOne, withTransaction, type RowDataPacket } from "./db";
import { ApiError } from "./session";
import { ensureMembership } from "./households";
import { rowToDetail, rowToListItem, type RecipeDetail, type RecipeListItem, type RecipeRow } from "./recipes";

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Zutat braucht einen Namen.").max(120),
  amount: z.union([z.number().nonnegative(), z.null()]).optional(),
  unit: z
    .union([z.string().trim().max(20), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
});

export const customRecipeInputSchema = z.object({
  title: z.string().trim().min(1, "Titel ist erforderlich.").max(255),
  imageUrl: z
    .union([z.string().trim().max(512).url("Bild-URL muss eine gueltige URL sein."), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  category: z
    .union([z.string().trim().max(80), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  area: z
    .union([z.string().trim().max(80), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  effort: z.enum(["quick", "normal", "elaborate"]).default("normal"),
  estMinutes: z.union([z.number().int().positive().max(1440), z.null()]).optional(),
  isVegetarian: z.boolean().default(false),
  isVegan: z.boolean().default(false),
  hasPork: z.boolean().default(false),
  ingredients: z
    .array(ingredientSchema)
    .min(1, "Bitte mindestens eine Zutat eintragen.")
    .max(80),
  steps: z
    .array(z.string().trim().min(1, "Leere Schritte sind nicht erlaubt.").max(2000))
    .min(1, "Bitte mindestens einen Schritt eintragen.")
    .max(60),
});

export type CustomRecipeInput = z.infer<typeof customRecipeInputSchema>;

interface DetailRow extends RecipeRow, RowDataPacket {
  household_id: number | null;
  created_by: number | null;
}

interface ListRow extends RecipeRow, RowDataPacket {
  household_id: number | null;
  created_by: number | null;
  created_by_username: string | null;
  liked: number;
}

export interface CustomRecipeListItem extends RecipeListItem {
  liked: boolean;
  createdByUsername: string | null;
  isMine: boolean;
  createdBy: number | null;
  canDelete: boolean;
}

function genExternalId(): string {
  return `cust_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export function canManageCustomRecipe(
  role: "owner" | "member",
  createdBy: number | null,
  userId: number
): boolean {
  if (role === "owner") return true;
  return createdBy != null && createdBy === userId;
}

function normalizeFlags(input: CustomRecipeInput): CustomRecipeInput {
  const next = { ...input };
  if (next.isVegan) next.isVegetarian = true;
  if (next.isVegetarian) next.hasPork = false;
  return next;
}

export async function listCustomRecipes(
  userId: number,
  householdId: number
): Promise<CustomRecipeListItem[]> {
  const role = await ensureMembership(userId, householdId);
  const rows = await query<ListRow>(
    `SELECT r.id, r.source, r.external_id, r.title_de, r.title_orig, r.image_url, r.category,
            r.area, r.tags, r.is_vegetarian, r.is_vegan, r.has_pork, r.effort, r.est_minutes,
            r.ingredients_json, r.steps_json, r.household_id, r.created_by,
            u.username AS created_by_username,
            CASE WHEN hrs.status = 'liked' THEN 1 ELSE 0 END AS liked
       FROM recipe_cache r
       LEFT JOIN users u ON u.id = r.created_by
       LEFT JOIN household_recipe_state hrs
              ON hrs.recipe_id = r.id AND hrs.household_id = r.household_id
      WHERE r.household_id = ?
      ORDER BY r.created_at DESC`,
    [householdId]
  );
  return rows.map((r) => ({
    ...rowToListItem(r),
    liked: r.liked === 1,
    createdByUsername: r.created_by_username,
    isMine: r.created_by === userId,
    createdBy: r.created_by,
    canDelete: canManageCustomRecipe(role, r.created_by, userId),
  }));
}

export async function getCustomRecipe(
  userId: number,
  householdId: number,
  recipeId: number
): Promise<RecipeDetail & { createdBy: number | null; createdByUsername: string | null }> {
  await ensureMembership(userId, householdId);
  const row = await queryOne<
    DetailRow & RowDataPacket & { created_by_username: string | null }
  >(
    `SELECT r.id, r.source, r.external_id, r.title_de, r.title_orig, r.image_url, r.category,
            r.area, r.tags, r.is_vegetarian, r.is_vegan, r.has_pork, r.effort, r.est_minutes,
            r.ingredients_json, r.steps_json, r.household_id, r.created_by,
            u.username AS created_by_username
       FROM recipe_cache r
       LEFT JOIN users u ON u.id = r.created_by
      WHERE r.id = ? LIMIT 1`,
    [recipeId]
  );
  if (!row) throw new ApiError(404, "Rezept nicht gefunden.");
  if (row.household_id !== householdId) {
    throw new ApiError(403, "Rezept gehoert zu einem anderen Haushalt.");
  }
  return {
    ...rowToDetail(row),
    createdBy: row.created_by,
    createdByUsername: row.created_by_username,
  };
}

export async function createCustomRecipe(
  userId: number,
  householdId: number,
  raw: CustomRecipeInput
): Promise<{ id: number }> {
  await ensureMembership(userId, householdId);
  const input = normalizeFlags(raw);

  const externalId = genExternalId();
  const ingredientsJson = JSON.stringify(
    input.ingredients.map((i) => ({
      name: i.name,
      amount: i.amount ?? null,
      unit: i.unit ?? null,
    }))
  );
  const stepsJson = JSON.stringify(input.steps);

  return withTransaction(async (conn) => {
    const [result] = await conn.query<import("mysql2/promise").ResultSetHeader>(
      `INSERT INTO recipe_cache
        (household_id, created_by, source, external_id, title_de, title_orig,
         image_url, category, area, tags,
         is_vegetarian, is_vegan, has_pork, effort, est_minutes,
         ingredients_json, steps_json)
       VALUES (?, ?, 'custom', ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        householdId,
        userId,
        externalId,
        input.title,
        input.imageUrl ?? null,
        input.category ?? null,
        input.area ?? null,
        input.isVegetarian ? 1 : 0,
        input.isVegan ? 1 : 0,
        input.hasPork ? 1 : 0,
        input.effort,
        input.estMinutes ?? null,
        ingredientsJson,
        stepsJson,
      ]
    );
    const recipeId = result.insertId;

    // Eigenes Rezept gilt automatisch als "gemerkt", damit es ohne Swipe direkt
    // im Kochbereich verfuegbar ist. Mitglieder koennen es trotzdem im Swipe-
    // Deck per "passed" wieder ausblenden.
    await conn.query(
      `INSERT INTO household_recipe_state (household_id, recipe_id, status, decided_by)
       VALUES (?, ?, 'liked', ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status),
                                decided_by = VALUES(decided_by),
                                decided_at = CURRENT_TIMESTAMP`,
      [householdId, recipeId, userId]
    );

    return { id: recipeId };
  });
}

export async function updateCustomRecipe(
  userId: number,
  householdId: number,
  recipeId: number,
  raw: CustomRecipeInput
): Promise<void> {
  const role = await ensureMembership(userId, householdId);
  const input = normalizeFlags(raw);

  const ingredientsJson = JSON.stringify(
    input.ingredients.map((i) => ({
      name: i.name,
      amount: i.amount ?? null,
      unit: i.unit ?? null,
    }))
  );
  const stepsJson = JSON.stringify(input.steps);

  await withTransaction(async (conn) => {
    const [rows] = await conn.query<
      (RowDataPacket & { household_id: number | null; created_by: number | null })[]
    >(
      "SELECT household_id, created_by FROM recipe_cache WHERE id = ? LIMIT 1 FOR UPDATE",
      [recipeId]
    );
    const row = rows[0];
    if (!row) throw new ApiError(404, "Rezept nicht gefunden.");
    if (row.household_id !== householdId) {
      throw new ApiError(403, "Rezept gehoert zu einem anderen Haushalt.");
    }
    if (!canManageCustomRecipe(role, row.created_by, userId)) {
      throw new ApiError(403, "Nur der Ersteller oder ein Owner darf das Rezept aendern.");
    }
    await conn.query(
      `UPDATE recipe_cache
          SET title_de = ?, image_url = ?, category = ?, area = ?,
              is_vegetarian = ?, is_vegan = ?, has_pork = ?, effort = ?, est_minutes = ?,
              ingredients_json = ?, steps_json = ?
        WHERE id = ?`,
      [
        input.title,
        input.imageUrl ?? null,
        input.category ?? null,
        input.area ?? null,
        input.isVegetarian ? 1 : 0,
        input.isVegan ? 1 : 0,
        input.hasPork ? 1 : 0,
        input.effort,
        input.estMinutes ?? null,
        ingredientsJson,
        stepsJson,
        recipeId,
      ]
    );
  });
}

export async function deleteCustomRecipe(
  userId: number,
  householdId: number,
  recipeId: number
): Promise<void> {
  const role = await ensureMembership(userId, householdId);
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<
      (RowDataPacket & { household_id: number | null; created_by: number | null })[]
    >(
      "SELECT household_id, created_by FROM recipe_cache WHERE id = ? LIMIT 1 FOR UPDATE",
      [recipeId]
    );
    const row = rows[0];
    if (!row) throw new ApiError(404, "Rezept nicht gefunden.");
    if (row.household_id !== householdId) {
      throw new ApiError(403, "Rezept gehoert zu einem anderen Haushalt.");
    }
    if (!canManageCustomRecipe(role, row.created_by, userId)) {
      throw new ApiError(403, "Nur der Ersteller oder ein Owner darf das Rezept loeschen.");
    }
    // Hard-Delete; Cascading FKs raeumen Swipe-State und Cooking-Choices auf.
    await conn.query("DELETE FROM recipe_cache WHERE id = ?", [recipeId]);
  });
}
