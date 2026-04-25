import { execute, query, queryOne, withTransaction, type RowDataPacket } from "./db";
import { ApiError } from "./session";
import { ensureMembership } from "./households";

export interface ShoppingList {
  id: number;
  householdId: number;
  status: "open" | "done";
  createdAt: string;
  closedAt: string | null;
}

export interface ShoppingItem {
  id: number;
  listId: number;
  recipeId: number | null;
  recipeTitle: string | null;
  name: string;
  amount: number | null;
  unit: string | null;
  checked: boolean;
  createdBy: number | null;
  updatedAt: string;
}

interface ListRow extends RowDataPacket {
  id: number;
  household_id: number;
  status: "open" | "done";
  created_at: string;
  closed_at: string | null;
}

interface ItemRow extends RowDataPacket {
  id: number;
  list_id: number;
  recipe_id: number | null;
  recipe_title: string | null;
  name: string;
  amount: string | null;
  unit: string | null;
  checked: number;
  created_by: number | null;
  updated_at: string;
}

function listToObj(row: ListRow): ShoppingList {
  return {
    id: row.id,
    householdId: row.household_id,
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

function itemToObj(row: ItemRow): ShoppingItem {
  return {
    id: row.id,
    listId: row.list_id,
    recipeId: row.recipe_id,
    recipeTitle: row.recipe_title,
    name: row.name,
    amount: row.amount === null ? null : Number(row.amount),
    unit: row.unit,
    checked: row.checked === 1,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export async function getOrCreateOpenList(householdId: number): Promise<ShoppingList> {
  const existing = await queryOne<ListRow>(
    `SELECT id, household_id, status, created_at, closed_at
       FROM shopping_lists
      WHERE household_id = ? AND status = 'open'
      ORDER BY created_at DESC LIMIT 1`,
    [householdId]
  );
  if (existing) return listToObj(existing);
  const created = await execute(
    "INSERT INTO shopping_lists (household_id, status) VALUES (?, 'open')",
    [householdId]
  );
  const fresh = await queryOne<ListRow>(
    "SELECT id, household_id, status, created_at, closed_at FROM shopping_lists WHERE id = ?",
    [created.insertId]
  );
  return listToObj(fresh!);
}

export async function listItems(
  userId: number,
  householdId: number
): Promise<{ list: ShoppingList; items: ShoppingItem[] }> {
  await ensureMembership(userId, householdId);
  const list = await getOrCreateOpenList(householdId);
  const items = await query<ItemRow>(
    `SELECT i.id, i.list_id, i.recipe_id, r.title_de AS recipe_title,
            i.name, i.amount, i.unit, i.checked, i.created_by, i.updated_at
       FROM shopping_list_items i
       LEFT JOIN recipe_cache r ON r.id = i.recipe_id
      WHERE i.list_id = ?
      ORDER BY i.checked ASC, i.created_at ASC`,
    [list.id]
  );
  return { list, items: items.map(itemToObj) };
}

export async function addItem(
  userId: number,
  householdId: number,
  data: {
    name: string;
    amount?: number | null;
    unit?: string | null;
    recipeId?: number | null;
  }
): Promise<ShoppingItem> {
  await ensureMembership(userId, householdId);
  const list = await getOrCreateOpenList(householdId);
  const result = await execute(
    `INSERT INTO shopping_list_items (list_id, recipe_id, name, amount, unit, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      list.id,
      data.recipeId ?? null,
      data.name,
      data.amount ?? null,
      data.unit ?? null,
      userId,
    ]
  );
  const fresh = await queryOne<ItemRow>(
    `SELECT i.id, i.list_id, i.recipe_id, r.title_de AS recipe_title,
            i.name, i.amount, i.unit, i.checked, i.created_by, i.updated_at
       FROM shopping_list_items i
       LEFT JOIN recipe_cache r ON r.id = i.recipe_id
      WHERE i.id = ?`,
    [result.insertId]
  );
  return itemToObj(fresh!);
}

export async function setItemChecked(
  userId: number,
  householdId: number,
  itemId: number,
  checked: boolean
): Promise<void> {
  await ensureMembership(userId, householdId);
  const item = await queryOne<RowDataPacket & { list_id: number; household_id: number }>(
    `SELECT i.list_id, l.household_id
       FROM shopping_list_items i
       JOIN shopping_lists l ON l.id = i.list_id
      WHERE i.id = ?`,
    [itemId]
  );
  if (!item) throw new ApiError(404, "Eintrag nicht gefunden.");
  if (item.household_id !== householdId) {
    throw new ApiError(403, "Eintrag gehoert zu einem anderen Haushalt.");
  }
  await execute("UPDATE shopping_list_items SET checked = ? WHERE id = ?", [
    checked ? 1 : 0,
    itemId,
  ]);
}

export async function deleteItem(
  userId: number,
  householdId: number,
  itemId: number
): Promise<void> {
  await ensureMembership(userId, householdId);
  await execute(
    `DELETE i FROM shopping_list_items i
       JOIN shopping_lists l ON l.id = i.list_id
      WHERE i.id = ? AND l.household_id = ?`,
    [itemId, householdId]
  );
}

export async function finishList(userId: number, householdId: number): Promise<void> {
  await ensureMembership(userId, householdId);
  await withTransaction(async (conn) => {
    const [openLists] = await conn.query<
      (RowDataPacket & { id: number })[]
    >(
      `SELECT id FROM shopping_lists
        WHERE household_id = ? AND status = 'open'
        ORDER BY created_at DESC`,
      [householdId]
    );
    for (const l of openLists) {
      await conn.query(
        "UPDATE shopping_lists SET status = 'done', closed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [l.id]
      );
    }
  });
}
