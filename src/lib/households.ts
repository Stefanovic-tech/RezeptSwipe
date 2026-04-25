import { execute, query, queryOne, withTransaction, type RowDataPacket } from "./db";
import { generateInviteCode, normalizeInviteCode, sha256Hex } from "./hash";
import { ApiError } from "./session";

interface HouseholdRow extends RowDataPacket {
  id: number;
  name: string;
}

interface MemberRow extends RowDataPacket {
  user_id: number;
  username: string;
  role: "owner" | "member";
  joined_at: string;
}

interface InviteRow extends RowDataPacket {
  id: number;
  code_preview: string | null;
  created_at: string;
  used_count: number;
  max_uses: number;
  revoked_at: string | null;
  expires_at: string | null;
  household_id: number;
  created_by_username: string | null;
}

export async function ensureMembership(
  userId: number,
  householdId: number
): Promise<"owner" | "member"> {
  const row = await queryOne<RowDataPacket & { role: "owner" | "member" }>(
    `SELECT role FROM household_members
     WHERE household_id = ? AND user_id = ? LIMIT 1`,
    [householdId, userId]
  );
  if (!row) throw new ApiError(403, "Kein Mitglied dieses Haushalts.");
  return row.role;
}

export async function ensureOwner(userId: number, householdId: number) {
  const role = await ensureMembership(userId, householdId);
  if (role !== "owner") throw new ApiError(403, "Nur Owner darf das.");
}

export async function getHousehold(id: number): Promise<HouseholdRow | null> {
  return queryOne<HouseholdRow>("SELECT id, name FROM households WHERE id = ? LIMIT 1", [id]);
}

export async function listMembers(householdId: number): Promise<MemberRow[]> {
  return query<MemberRow>(
    `SELECT m.user_id, u.username, m.role, m.joined_at
     FROM household_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.household_id = ?
     ORDER BY m.role DESC, u.username ASC`,
    [householdId]
  );
}

export async function listInvites(householdId: number): Promise<InviteRow[]> {
  return query<InviteRow>(
    `SELECT i.id, i.code_preview, i.created_at, i.used_count, i.max_uses,
            i.revoked_at, i.expires_at, i.household_id, u.username AS created_by_username
       FROM household_invites i
       LEFT JOIN users u ON u.id = i.created_by
      WHERE i.household_id = ?
      ORDER BY i.created_at DESC`,
    [householdId]
  );
}

export async function createInvite(
  userId: number,
  householdId: number,
  options: { maxUses?: number; expiresInDays?: number | null } = {}
): Promise<{ code: string; id: number }> {
  await ensureOwner(userId, householdId);
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
    [householdId, codeHash, preview, userId, Math.max(1, options.maxUses ?? 1), expiresAt]
  );
  return { code, id: result.insertId };
}

export async function revokeInvite(userId: number, inviteId: number): Promise<void> {
  const invite = await queryOne<RowDataPacket & { household_id: number; revoked_at: string | null }>(
    "SELECT household_id, revoked_at FROM household_invites WHERE id = ? LIMIT 1",
    [inviteId]
  );
  if (!invite) throw new ApiError(404, "Invite nicht gefunden.");
  await ensureOwner(userId, invite.household_id);
  if (invite.revoked_at) return;
  await execute(
    "UPDATE household_invites SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
    [inviteId]
  );
}

export async function redeemInviteForExistingUser(
  userId: number,
  inviteCode: string
): Promise<{ householdId: number }> {
  return withTransaction(async (conn) => {
    const codeHash = sha256Hex(normalizeInviteCode(inviteCode));
    const [rows] = await conn.query<
      (RowDataPacket & {
        id: number;
        household_id: number;
        max_uses: number;
        used_count: number;
        revoked_at: string | null;
        expires_at: string | null;
      })[]
    >(
      `SELECT id, household_id, max_uses, used_count, revoked_at, expires_at
       FROM household_invites WHERE code_hash = ? LIMIT 1 FOR UPDATE`,
      [codeHash]
    );
    const invite = rows[0];
    if (!invite) throw new ApiError(400, "Invite-Code ist ungueltig.");
    if (invite.revoked_at) throw new ApiError(400, "Invite-Code wurde widerrufen.");
    if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
      throw new ApiError(400, "Invite-Code ist abgelaufen.");
    }
    if (invite.used_count >= invite.max_uses) {
      throw new ApiError(400, "Invite-Code wurde bereits maximal genutzt.");
    }

    const [memberRows] = await conn.query<RowDataPacket[]>(
      "SELECT user_id FROM household_members WHERE household_id = ? AND user_id = ?",
      [invite.household_id, userId]
    );
    if (memberRows.length > 0) {
      throw new ApiError(400, "Du bist bereits Mitglied dieses Haushalts.");
    }

    await conn.query(
      "INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'member')",
      [invite.household_id, userId]
    );
    await conn.query(
      "UPDATE household_invites SET used_count = used_count + 1 WHERE id = ?",
      [invite.id]
    );
    await conn.query(
      "UPDATE users SET current_household_id = COALESCE(current_household_id, ?) WHERE id = ?",
      [invite.household_id, userId]
    );

    return { householdId: invite.household_id };
  });
}

export async function switchCurrentHousehold(
  userId: number,
  householdId: number
): Promise<void> {
  await ensureMembership(userId, householdId);
  await execute("UPDATE users SET current_household_id = ? WHERE id = ?", [
    householdId,
    userId,
  ]);
}

export async function transferOwnership(
  currentOwnerId: number,
  householdId: number,
  newOwnerUserId: number
): Promise<void> {
  await ensureOwner(currentOwnerId, householdId);
  if (currentOwnerId === newOwnerUserId) return;
  await withTransaction(async (conn) => {
    const [target] = await conn.query<RowDataPacket[]>(
      "SELECT user_id FROM household_members WHERE household_id = ? AND user_id = ?",
      [householdId, newOwnerUserId]
    );
    if (target.length === 0) {
      throw new ApiError(400, "Zielnutzer ist kein Mitglied.");
    }
    await conn.query(
      `UPDATE household_members SET role = 'member'
       WHERE household_id = ? AND user_id = ?`,
      [householdId, currentOwnerId]
    );
    await conn.query(
      `UPDATE household_members SET role = 'owner'
       WHERE household_id = ? AND user_id = ?`,
      [householdId, newOwnerUserId]
    );
  });
}

export async function leaveHousehold(userId: number, householdId: number): Promise<void> {
  return withTransaction(async (conn) => {
    const [membership] = await conn.query<
      (RowDataPacket & { role: "owner" | "member" })[]
    >("SELECT role FROM household_members WHERE household_id = ? AND user_id = ?", [
      householdId,
      userId,
    ]);
    if (membership.length === 0) throw new ApiError(400, "Kein Mitglied.");
    const role = membership[0].role;

    const [members] = await conn.query<RowDataPacket[]>(
      "SELECT user_id FROM household_members WHERE household_id = ?",
      [householdId]
    );

    if (role === "owner" && members.length > 1) {
      throw new ApiError(
        400,
        "Bitte zuerst Owner-Rolle uebertragen, bevor du den Haushalt verlaesst."
      );
    }

    await conn.query(
      "DELETE FROM household_members WHERE household_id = ? AND user_id = ?",
      [householdId, userId]
    );

    if (members.length === 1) {
      await conn.query("DELETE FROM households WHERE id = ?", [householdId]);
    }

    await conn.query(
      `UPDATE users SET current_household_id =
         (SELECT household_id FROM household_members WHERE user_id = ? LIMIT 1)
       WHERE id = ?`,
      [userId, userId]
    );
  });
}

export async function getPreferences(householdId: number) {
  const row = await queryOne<
    RowDataPacket & { vegetarian: number; vegan: number; no_pork: number }
  >(
    "SELECT vegetarian, vegan, no_pork FROM household_preferences WHERE household_id = ?",
    [householdId]
  );
  if (!row) {
    await execute(
      "INSERT INTO household_preferences (household_id) VALUES (?) ON DUPLICATE KEY UPDATE household_id = household_id",
      [householdId]
    );
    return { vegetarian: false, vegan: false, no_pork: false };
  }
  return {
    vegetarian: row.vegetarian === 1,
    vegan: row.vegan === 1,
    no_pork: row.no_pork === 1,
  };
}

export async function setPreferences(
  householdId: number,
  prefs: { vegetarian: boolean; vegan: boolean; no_pork: boolean }
) {
  await execute(
    `INSERT INTO household_preferences (household_id, vegetarian, vegan, no_pork)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE vegetarian = VALUES(vegetarian),
                              vegan = VALUES(vegan),
                              no_pork = VALUES(no_pork)`,
    [householdId, prefs.vegetarian ? 1 : 0, prefs.vegan ? 1 : 0, prefs.no_pork ? 1 : 0]
  );
}
