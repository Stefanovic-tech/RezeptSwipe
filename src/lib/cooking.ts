import { execute, query, queryOne, withTransaction, type RowDataPacket } from "./db";
import { ApiError } from "./session";
import { ensureMembership } from "./households";
import { getRecipeDetail, type RecipeDetail } from "./recipes";

export interface CookingSession {
  id: number;
  householdId: number;
  effort: "quick" | "normal" | "elaborate" | "any";
  maxMinutes: number | null;
  status: "active" | "finished" | "cancelled";
  createdAt: string;
}

interface SessionRow extends RowDataPacket {
  id: number;
  household_id: number;
  effort: CookingSession["effort"];
  max_minutes: number | null;
  status: CookingSession["status"];
  created_at: string;
}

export async function startCookingSession(
  userId: number,
  householdId: number,
  options: { effort: CookingSession["effort"]; maxMinutes: number | null }
): Promise<CookingSession> {
  await ensureMembership(userId, householdId);
  const result = await execute(
    `INSERT INTO cooking_sessions (household_id, started_by, effort, max_minutes)
     VALUES (?, ?, ?, ?)`,
    [householdId, userId, options.effort, options.maxMinutes]
  );
  const created = await queryOne<SessionRow>(
    "SELECT id, household_id, effort, max_minutes, status, created_at FROM cooking_sessions WHERE id = ?",
    [result.insertId]
  );
  if (!created) throw new ApiError(500, "Session konnte nicht angelegt werden.");
  return {
    id: created.id,
    householdId: created.household_id,
    effort: created.effort,
    maxMinutes: created.max_minutes,
    status: created.status,
    createdAt: created.created_at,
  };
}

export async function getActiveCookingSession(
  householdId: number
): Promise<CookingSession | null> {
  const row = await queryOne<SessionRow>(
    `SELECT id, household_id, effort, max_minutes, status, created_at
       FROM cooking_sessions
      WHERE household_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1`,
    [householdId]
  );
  if (!row) return null;
  return {
    id: row.id,
    householdId: row.household_id,
    effort: row.effort,
    maxMinutes: row.max_minutes,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getNextCandidate(
  householdId: number,
  sessionId: number
): Promise<RecipeDetail | null> {
  const session = await queryOne<SessionRow>(
    `SELECT id, household_id, effort, max_minutes, status FROM cooking_sessions WHERE id = ?`,
    [sessionId]
  );
  if (!session) throw new ApiError(404, "Session nicht gefunden.");
  if (session.household_id !== householdId) {
    throw new ApiError(403, "Session gehoert zu einem anderen Haushalt.");
  }
  if (session.status !== "active") return null;

  const where: string[] = [
    "hrs.household_id = ?",
    "hrs.status = 'liked'",
    "csc.id IS NULL",
  ];
  const params: unknown[] = [householdId, sessionId];
  if (session.effort !== "any") {
    where.push("r.effort = ?");
    params.push(session.effort);
  }
  if (session.max_minutes) {
    where.push("(r.est_minutes IS NULL OR r.est_minutes <= ?)");
    params.push(session.max_minutes);
  }

  const row = await queryOne<RowDataPacket & { id: number }>(
    `SELECT r.id
       FROM household_recipe_state hrs
       JOIN recipe_cache r ON r.id = hrs.recipe_id
       LEFT JOIN cooking_session_choices csc
              ON csc.recipe_id = r.id AND csc.session_id = ?
      WHERE ${where.join(" AND ")}
      ORDER BY RAND()
      LIMIT 1`,
    [sessionId, ...params.slice(0)]
  );
  if (!row) return null;
  return getRecipeDetail(row.id);
}

export async function decideCandidate(
  userId: number,
  householdId: number,
  sessionId: number,
  recipeId: number,
  accepted: boolean
): Promise<{ session: CookingSession; addedToShopping: boolean }> {
  await ensureMembership(userId, householdId);
  return withTransaction(async (conn) => {
    const [sessionRows] = await conn.query<SessionRow[]>(
      `SELECT id, household_id, effort, max_minutes, status, created_at
         FROM cooking_sessions WHERE id = ? AND household_id = ? FOR UPDATE`,
      [sessionId, householdId]
    );
    const session = sessionRows[0];
    if (!session) throw new ApiError(404, "Session nicht gefunden.");
    if (session.status !== "active") {
      throw new ApiError(400, "Session ist nicht aktiv.");
    }

    await conn.query(
      `INSERT INTO cooking_session_choices (session_id, recipe_id, accepted)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE accepted = VALUES(accepted), decided_at = CURRENT_TIMESTAMP`,
      [sessionId, recipeId, accepted ? 1 : 0]
    );

    let addedToShopping = false;

    if (accepted) {
      // Eine offene Liste pro Haushalt; sonst neu erstellen
      const [openLists] = await conn.query<
        (RowDataPacket & { id: number })[]
      >(
        `SELECT id FROM shopping_lists
          WHERE household_id = ? AND status = 'open'
          ORDER BY created_at DESC LIMIT 1`,
        [householdId]
      );
      let listId: number;
      if (openLists.length === 0) {
        const [created] = await conn.query<import("mysql2/promise").ResultSetHeader>(
          "INSERT INTO shopping_lists (household_id, status) VALUES (?, 'open')",
          [householdId]
        );
        listId = created.insertId;
      } else {
        listId = openLists[0].id;
      }

      const [recipeRows] = await conn.query<
        (RowDataPacket & { ingredients_json: string })[]
      >("SELECT ingredients_json FROM recipe_cache WHERE id = ?", [recipeId]);
      if (recipeRows[0]) {
        let ingredients: Array<{ name: string; amount: number | null; unit: string | null }> = [];
        try {
          ingredients = JSON.parse(recipeRows[0].ingredients_json);
        } catch {
          ingredients = [];
        }
        for (const ing of ingredients) {
          await conn.query(
            `INSERT INTO shopping_list_items
                (list_id, recipe_id, name, amount, unit, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              listId,
              recipeId,
              ing.name,
              ing.amount === null ? null : Number(ing.amount),
              ing.unit ?? null,
              userId,
            ]
          );
        }
        addedToShopping = ingredients.length > 0;
      }

      await conn.query(
        `UPDATE cooking_sessions SET status = 'finished', finished_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [sessionId]
      );
    }

    const [refreshed] = await conn.query<SessionRow[]>(
      "SELECT id, household_id, effort, max_minutes, status, created_at FROM cooking_sessions WHERE id = ?",
      [sessionId]
    );
    const r = refreshed[0]!;

    return {
      session: {
        id: r.id,
        householdId: r.household_id,
        effort: r.effort,
        maxMinutes: r.max_minutes,
        status: r.status,
        createdAt: r.created_at,
      },
      addedToShopping,
    };
  });
}

export async function cancelCookingSession(
  userId: number,
  householdId: number,
  sessionId: number
): Promise<void> {
  await ensureMembership(userId, householdId);
  await execute(
    `UPDATE cooking_sessions SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP
       WHERE id = ? AND household_id = ? AND status = 'active'`,
    [sessionId, householdId]
  );
}
