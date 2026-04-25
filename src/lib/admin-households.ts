import { execute, query, queryOne, withTransaction, type RowDataPacket } from "./db";
import { generateInviteCode, sha256Hex, verifyPassword } from "./hash";
import { ApiError } from "./session";
import { logAdminAction } from "./audit";

interface HouseholdListRow extends RowDataPacket {
  id: number;
  name: string;
  created_at: string;
  member_count: number;
  invite_count: number;
  active_invite_count: number;
  owner_username: string | null;
}

export interface AdminHouseholdListItem {
  id: number;
  name: string;
  createdAt: string;
  memberCount: number;
  inviteCount: number;
  activeInviteCount: number;
  ownerUsername: string | null;
}

export async function listHouseholdsForAdminFull(
  search = ""
): Promise<AdminHouseholdListItem[]> {
  const params: unknown[] = [];
  let where = "";
  if (search) {
    where = "WHERE LOWER(h.name) LIKE ?";
    params.push(`%${search.toLowerCase()}%`);
  }
  const rows = await query<HouseholdListRow>(
    `SELECT h.id, h.name, h.created_at,
            (SELECT COUNT(*) FROM household_members WHERE household_id = h.id) AS member_count,
            (SELECT COUNT(*) FROM household_invites WHERE household_id = h.id) AS invite_count,
            (SELECT COUNT(*) FROM household_invites
              WHERE household_id = h.id
                AND revoked_at IS NULL
                AND (expires_at IS NULL OR expires_at > NOW())
                AND used_count < max_uses) AS active_invite_count,
            (SELECT u.username FROM household_members m
              JOIN users u ON u.id = m.user_id
              WHERE m.household_id = h.id AND m.role = 'owner'
              ORDER BY m.joined_at ASC LIMIT 1) AS owner_username
       FROM households h
       ${where}
      ORDER BY h.name ASC
      LIMIT 500`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    memberCount: Number(r.member_count) || 0,
    inviteCount: Number(r.invite_count) || 0,
    activeInviteCount: Number(r.active_invite_count) || 0,
    ownerUsername: r.owner_username,
  }));
}

export interface AdminHouseholdDetail {
  id: number;
  name: string;
  createdAt: string;
  members: Array<{
    userId: number;
    username: string;
    role: "owner" | "member";
    joinedAt: string;
  }>;
  invites: Array<{
    id: number;
    codePreview: string | null;
    createdAt: string;
    createdByUsername: string | null;
    expiresAt: string | null;
    maxUses: number;
    usedCount: number;
    revokedAt: string | null;
  }>;
  stats: {
    likedCount: number;
    customRecipeCount: number;
    cookingSessions: number;
    shoppingLists: number;
  };
}

export async function getHouseholdAdminDetail(
  householdId: number
): Promise<AdminHouseholdDetail | null> {
  const hh = await queryOne<RowDataPacket & {
    id: number;
    name: string;
    created_at: string;
  }>(
    "SELECT id, name, created_at FROM households WHERE id = ? LIMIT 1",
    [householdId]
  );
  if (!hh) return null;

  const members = await query<RowDataPacket & {
    user_id: number;
    username: string;
    role: "owner" | "member";
    joined_at: string;
  }>(
    `SELECT m.user_id, u.username, m.role, m.joined_at
       FROM household_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.household_id = ?
      ORDER BY m.role DESC, u.username ASC`,
    [householdId]
  );

  const invites = await query<RowDataPacket & {
    id: number;
    code_preview: string | null;
    created_at: string;
    created_by_username: string | null;
    expires_at: string | null;
    max_uses: number;
    used_count: number;
    revoked_at: string | null;
  }>(
    `SELECT i.id, i.code_preview, i.created_at,
            u.username AS created_by_username,
            i.expires_at, i.max_uses, i.used_count, i.revoked_at
       FROM household_invites i
       LEFT JOIN users u ON u.id = i.created_by
      WHERE i.household_id = ?
      ORDER BY i.created_at DESC
      LIMIT 100`,
    [householdId]
  );

  const stats = await queryOne<RowDataPacket & {
    liked_count: number;
    custom_recipe_count: number;
    cooking_sessions: number;
    shopping_lists: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM household_recipe_state WHERE household_id = ? AND status = 'liked') AS liked_count,
       (SELECT COUNT(*) FROM recipe_cache WHERE household_id = ?) AS custom_recipe_count,
       (SELECT COUNT(*) FROM cooking_sessions WHERE household_id = ?) AS cooking_sessions,
       (SELECT COUNT(*) FROM shopping_lists WHERE household_id = ?) AS shopping_lists`,
    [householdId, householdId, householdId, householdId]
  );

  return {
    id: hh.id,
    name: hh.name,
    createdAt: hh.created_at,
    members: members.map((m) => ({
      userId: m.user_id,
      username: m.username,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    invites: invites.map((i) => ({
      id: i.id,
      codePreview: i.code_preview,
      createdAt: i.created_at,
      createdByUsername: i.created_by_username,
      expiresAt: i.expires_at,
      maxUses: i.max_uses,
      usedCount: i.used_count,
      revokedAt: i.revoked_at,
    })),
    stats: {
      likedCount: Number(stats?.liked_count) || 0,
      customRecipeCount: Number(stats?.custom_recipe_count) || 0,
      cookingSessions: Number(stats?.cooking_sessions) || 0,
      shoppingLists: Number(stats?.shopping_lists) || 0,
    },
  };
}

export async function adminRenameHousehold(
  actorId: number,
  householdId: number,
  newName: string
): Promise<void> {
  const trimmed = newName.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new ApiError(400, "Haushaltsname muss zwischen 1 und 80 Zeichen haben.");
  }
  const hh = await queryOne<RowDataPacket & { id: number; name: string }>(
    "SELECT id, name FROM households WHERE id = ? LIMIT 1",
    [householdId]
  );
  if (!hh) throw new ApiError(404, "Haushalt nicht gefunden.");
  await execute("UPDATE households SET name = ? WHERE id = ?", [trimmed, householdId]);
  await logAdminAction({
    actorUserId: actorId,
    action: "household.renamed",
    targetHouseholdId: householdId,
    meta: { from: hh.name, to: trimmed },
  });
}

export async function adminSetMemberRole(
  actorId: number,
  householdId: number,
  targetUserId: number,
  role: "owner" | "member"
): Promise<void> {
  await withTransaction(async (conn) => {
    const [hhRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM households WHERE id = ? LIMIT 1 FOR UPDATE",
      [householdId]
    );
    if (hhRows.length === 0) throw new ApiError(404, "Haushalt nicht gefunden.");

    const [memberRows] = await conn.query<
      (RowDataPacket & { role: "owner" | "member" })[]
    >(
      "SELECT role FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1 FOR UPDATE",
      [householdId, targetUserId]
    );
    const member = memberRows[0];
    if (!member) throw new ApiError(404, "User ist kein Mitglied dieses Haushalts.");

    if (member.role === role) return;

    if (member.role === "owner" && role === "member") {
      const [otherOwners] = await conn.query<RowDataPacket[]>(
        `SELECT user_id FROM household_members
          WHERE household_id = ? AND role = 'owner' AND user_id <> ?
          LIMIT 1`,
        [householdId, targetUserId]
      );
      if (otherOwners.length === 0) {
        throw new ApiError(
          400,
          "Letzter Owner kann nicht herabgestuft werden. Bitte zuerst neuen Owner setzen."
        );
      }
    }

    await conn.query(
      "UPDATE household_members SET role = ? WHERE household_id = ? AND user_id = ?",
      [role, householdId, targetUserId]
    );
  });
  await logAdminAction({
    actorUserId: actorId,
    action: role === "owner" ? "household.member_promoted" : "household.member_demoted",
    targetUserId,
    targetHouseholdId: householdId,
  });
}

export async function adminTransferOwnership(
  actorId: number,
  householdId: number,
  newOwnerUserId: number
): Promise<void> {
  await withTransaction(async (conn) => {
    const [hhRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM households WHERE id = ? LIMIT 1 FOR UPDATE",
      [householdId]
    );
    if (hhRows.length === 0) throw new ApiError(404, "Haushalt nicht gefunden.");

    const [target] = await conn.query<
      (RowDataPacket & { user_id: number })[]
    >(
      "SELECT user_id FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1 FOR UPDATE",
      [householdId, newOwnerUserId]
    );
    if (target.length === 0) {
      throw new ApiError(400, "Zielnutzer ist kein Mitglied.");
    }

    await conn.query(
      `UPDATE household_members SET role = 'member'
        WHERE household_id = ? AND role = 'owner'`,
      [householdId]
    );
    await conn.query(
      `UPDATE household_members SET role = 'owner'
        WHERE household_id = ? AND user_id = ?`,
      [householdId, newOwnerUserId]
    );
  });
  await logAdminAction({
    actorUserId: actorId,
    action: "household.owner_transferred",
    targetUserId: newOwnerUserId,
    targetHouseholdId: householdId,
  });
}

export async function adminRevokeInvite(
  actorId: number,
  inviteId: number
): Promise<void> {
  const invite = await queryOne<
    RowDataPacket & { household_id: number; revoked_at: string | null }
  >(
    "SELECT household_id, revoked_at FROM household_invites WHERE id = ? LIMIT 1",
    [inviteId]
  );
  if (!invite) throw new ApiError(404, "Invite nicht gefunden.");
  if (invite.revoked_at) return;
  await execute(
    "UPDATE household_invites SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
    [inviteId]
  );
  await logAdminAction({
    actorUserId: actorId,
    action: "invite.revoked",
    targetHouseholdId: invite.household_id,
    meta: { inviteId },
  });
}

export async function adminCreateInviteForHousehold(
  actorId: number,
  householdId: number,
  options: { maxUses?: number; expiresInDays?: number | null } = {}
): Promise<{ id: number; code: string }> {
  const hh = await queryOne<RowDataPacket & { id: number }>(
    "SELECT id FROM households WHERE id = ? LIMIT 1",
    [householdId]
  );
  if (!hh) throw new ApiError(404, "Haushalt nicht gefunden.");

  const code = generateInviteCode(8);
  const codeHash = sha256Hex(code);
  const preview = code.slice(0, 4) + "...";
  const expiresAt =
    options.expiresInDays && options.expiresInDays > 0
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ")
      : null;

  const result = await execute(
    `INSERT INTO household_invites
       (household_id, code_hash, code_preview, created_by, max_uses, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [householdId, codeHash, preview, actorId, Math.max(1, options.maxUses ?? 1), expiresAt]
  );
  await logAdminAction({
    actorUserId: actorId,
    action: "invite.created",
    targetHouseholdId: householdId,
    meta: {
      inviteId: result.insertId,
      maxUses: Math.max(1, options.maxUses ?? 1),
      expiresInDays: options.expiresInDays ?? null,
    },
  });
  return { id: result.insertId, code };
}

export async function adminDeleteHousehold(
  actorId: number,
  householdId: number
): Promise<{ name: string; memberCount: number }> {
  const hh = await queryOne<RowDataPacket & { id: number; name: string }>(
    "SELECT id, name FROM households WHERE id = ? LIMIT 1",
    [householdId]
  );
  if (!hh) throw new ApiError(404, "Haushalt nicht gefunden.");

  let memberCount = 0;
  await withTransaction(async (conn) => {
    const [memberRows] = await conn.query<RowDataPacket[]>(
      "SELECT user_id FROM household_members WHERE household_id = ?",
      [householdId]
    );
    memberCount = memberRows.length;

    await conn.query(
      "UPDATE users SET current_household_id = NULL WHERE current_household_id = ?",
      [householdId]
    );
    await conn.query("DELETE FROM households WHERE id = ?", [householdId]);
  });
  await logAdminAction({
    actorUserId: actorId,
    action: "household.deleted",
    targetHouseholdId: null,
    meta: { householdId, name: hh.name, memberCount },
  });
  return { name: hh.name, memberCount };
}

export interface MergeResult {
  movedMembers: number;
  duplicateMembersResolved: number;
  movedRecipes: number;
  movedRecipeStates: number;
  movedCookingSessions: number;
  movedShoppingLists: number;
  movedInvites: number;
  preferencesAction: "kept-target" | "moved-from-source" | "none";
}

export async function adminMergeHouseholds(
  actorId: number,
  sourceId: number,
  targetId: number
): Promise<MergeResult> {
  if (sourceId === targetId) {
    throw new ApiError(400, "Quell- und Ziel-Haushalt sind identisch.");
  }

  const result: MergeResult = await withTransaction(async (conn) => {
    const [hhRows] = await conn.query<
      (RowDataPacket & { id: number; name: string })[]
    >(
      "SELECT id, name FROM households WHERE id IN (?, ?) LIMIT 2 FOR UPDATE",
      [sourceId, targetId]
    );
    const source = hhRows.find((r) => r.id === sourceId);
    const target = hhRows.find((r) => r.id === targetId);
    if (!source) throw new ApiError(404, "Quell-Haushalt nicht gefunden.");
    if (!target) throw new ApiError(404, "Ziel-Haushalt nicht gefunden.");

    let movedMembers = 0;
    let duplicateMembersResolved = 0;
    const [sourceMembers] = await conn.query<
      (RowDataPacket & { user_id: number; role: "owner" | "member"; joined_at: string })[]
    >(
      "SELECT user_id, role, joined_at FROM household_members WHERE household_id = ?",
      [sourceId]
    );
    const [targetMembers] = await conn.query<
      (RowDataPacket & { user_id: number; role: "owner" | "member" })[]
    >(
      "SELECT user_id, role FROM household_members WHERE household_id = ?",
      [targetId]
    );
    const targetMemberIds = new Set(targetMembers.map((m) => m.user_id));

    for (const m of sourceMembers) {
      if (targetMemberIds.has(m.user_id)) {
        duplicateMembersResolved++;
        continue;
      }
      await conn.query(
        `INSERT INTO household_members (household_id, user_id, role, joined_at)
         VALUES (?, ?, 'member', ?)`,
        [targetId, m.user_id, m.joined_at]
      );
      movedMembers++;
    }
    await conn.query(
      "DELETE FROM household_members WHERE household_id = ?",
      [sourceId]
    );

    const [recipeStates] = await conn.query<
      (RowDataPacket & { recipe_id: number; status: "liked" | "passed"; decided_by: number | null; decided_at: string })[]
    >(
      "SELECT recipe_id, status, decided_by, decided_at FROM household_recipe_state WHERE household_id = ?",
      [sourceId]
    );
    let movedRecipeStates = 0;
    for (const rs of recipeStates) {
      const [resInsert] = await conn.query<import("mysql2/promise").ResultSetHeader>(
        `INSERT INTO household_recipe_state
           (household_id, recipe_id, status, decided_by, decided_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           decided_by = VALUES(decided_by),
           decided_at = VALUES(decided_at)`,
        [targetId, rs.recipe_id, rs.status, rs.decided_by, rs.decided_at]
      );
      if (resInsert.affectedRows > 0) movedRecipeStates++;
    }
    await conn.query(
      "DELETE FROM household_recipe_state WHERE household_id = ?",
      [sourceId]
    );

    const [recipeMove] = await conn.query<import("mysql2/promise").ResultSetHeader>(
      "UPDATE recipe_cache SET household_id = ? WHERE household_id = ?",
      [targetId, sourceId]
    );
    const movedRecipes = recipeMove.affectedRows ?? 0;

    const [csMove] = await conn.query<import("mysql2/promise").ResultSetHeader>(
      "UPDATE cooking_sessions SET household_id = ? WHERE household_id = ?",
      [targetId, sourceId]
    );
    const movedCookingSessions = csMove.affectedRows ?? 0;

    const [slMove] = await conn.query<import("mysql2/promise").ResultSetHeader>(
      "UPDATE shopping_lists SET household_id = ? WHERE household_id = ?",
      [targetId, sourceId]
    );
    const movedShoppingLists = slMove.affectedRows ?? 0;

    const [inviteMove] = await conn.query<import("mysql2/promise").ResultSetHeader>(
      "UPDATE household_invites SET household_id = ? WHERE household_id = ?",
      [targetId, sourceId]
    );
    const movedInvites = inviteMove.affectedRows ?? 0;

    let preferencesAction: MergeResult["preferencesAction"] = "none";
    const [targetPref] = await conn.query<RowDataPacket[]>(
      "SELECT household_id FROM household_preferences WHERE household_id = ? LIMIT 1",
      [targetId]
    );
    const [sourcePref] = await conn.query<RowDataPacket[]>(
      "SELECT household_id FROM household_preferences WHERE household_id = ? LIMIT 1",
      [sourceId]
    );
    if (targetPref.length > 0) {
      preferencesAction = "kept-target";
      await conn.query(
        "DELETE FROM household_preferences WHERE household_id = ?",
        [sourceId]
      );
    } else if (sourcePref.length > 0) {
      await conn.query(
        "UPDATE household_preferences SET household_id = ? WHERE household_id = ?",
        [targetId, sourceId]
      );
      preferencesAction = "moved-from-source";
    }

    await conn.query(
      "UPDATE users SET current_household_id = ? WHERE current_household_id = ?",
      [targetId, sourceId]
    );

    await conn.query("DELETE FROM households WHERE id = ?", [sourceId]);

    return {
      movedMembers,
      duplicateMembersResolved,
      movedRecipes,
      movedRecipeStates,
      movedCookingSessions,
      movedShoppingLists,
      movedInvites,
      preferencesAction,
    };
  });

  await logAdminAction({
    actorUserId: actorId,
    action: "household.merged",
    targetHouseholdId: targetId,
    meta: { sourceHouseholdId: sourceId, targetHouseholdId: targetId, ...result },
  });

  return result;
}

/** Re-Auth: Admin muss sein eigenes Passwort erneut bestaetigen. */
export async function verifyAdminPassword(
  adminUserId: number,
  password: string
): Promise<void> {
  const row = await queryOne<RowDataPacket & { password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    [adminUserId]
  );
  if (!row) throw new ApiError(401, "Admin-Konto nicht gefunden.");
  const ok = await verifyPassword(row.password_hash, password);
  if (!ok) throw new ApiError(401, "Passwortbestaetigung fehlgeschlagen.");
}
