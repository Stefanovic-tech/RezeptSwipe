import { execute, query, queryOne, withTransaction, type RowDataPacket } from "./db";
import { hashPassword } from "./hash";
import { ApiError } from "./session";
import { logAdminAction } from "./audit";

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  is_admin: number;
  is_banned: number;
  created_at: string;
  last_login_at: string | null;
  household_count: number;
}

export interface AdminUserSummary {
  id: number;
  username: string;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  householdCount: number;
}

export async function listUsers(search = ""): Promise<AdminUserSummary[]> {
  const params: unknown[] = [];
  let where = "";
  if (search) {
    where = "WHERE u.username_lower LIKE ?";
    params.push(`%${search.toLowerCase()}%`);
  }
  const rows = await query<UserRow>(
    `SELECT u.id, u.username, u.is_admin, u.is_banned, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM household_members WHERE user_id = u.id) AS household_count
       FROM users u
       ${where}
      ORDER BY u.username ASC
      LIMIT 200`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    isAdmin: r.is_admin === 1,
    isBanned: r.is_banned === 1,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
    householdCount: r.household_count,
  }));
}

export async function setUserBanned(
  actorId: number,
  targetUserId: number,
  banned: boolean
): Promise<void> {
  await execute("UPDATE users SET is_banned = ? WHERE id = ?", [banned ? 1 : 0, targetUserId]);
  if (banned) {
    await execute(
      "UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
      [targetUserId]
    );
  }
  await logAdminAction({
    actorUserId: actorId,
    action: banned ? "user.banned" : "user.unbanned",
    targetUserId,
  });
}

export async function setUserAdmin(
  actorId: number,
  targetUserId: number,
  isAdmin: boolean
): Promise<void> {
  await execute("UPDATE users SET is_admin = ? WHERE id = ?", [isAdmin ? 1 : 0, targetUserId]);
  await logAdminAction({
    actorUserId: actorId,
    action: isAdmin ? "user.admin_granted" : "user.admin_revoked",
    targetUserId,
  });
}

export async function adminResetPassword(
  actorId: number,
  targetUserId: number,
  newPassword: string
): Promise<void> {
  const newHash = await hashPassword(newPassword);
  await withTransaction(async (conn) => {
    await conn.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, targetUserId]);
    await conn.query(
      "UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
      [targetUserId]
    );
  });
  await logAdminAction({
    actorUserId: actorId,
    action: "user.password_reset",
    targetUserId,
  });
}

export async function deleteUser(
  actorId: number,
  targetUserId: number
): Promise<{ deletedHouseholds: number[] }> {
  if (actorId === targetUserId) {
    throw new ApiError(400, "Du kannst dich nicht selbst loeschen.");
  }
  const deletedHouseholds: number[] = [];
  await withTransaction(async (conn) => {
    const [memberHouseholds] = await conn.query<
      (RowDataPacket & { household_id: number })[]
    >("SELECT household_id FROM household_members WHERE user_id = ?", [targetUserId]);

    await conn.query("DELETE FROM users WHERE id = ?", [targetUserId]);

    for (const m of memberHouseholds) {
      const [remaining] = await conn.query<RowDataPacket[]>(
        "SELECT user_id FROM household_members WHERE household_id = ? LIMIT 1",
        [m.household_id]
      );
      if (remaining.length === 0) {
        await conn.query("DELETE FROM households WHERE id = ?", [m.household_id]);
        deletedHouseholds.push(m.household_id);
      }
    }
  });
  await logAdminAction({
    actorUserId: actorId,
    action: "user.deleted",
    targetUserId,
    meta: { deletedHouseholds },
  });
  return { deletedHouseholds };
}

export async function getAuditLog(limit = 100) {
  return query<
    RowDataPacket & {
      id: number;
      actor_user_id: number | null;
      actor_username: string | null;
      action: string;
      target_user_id: number | null;
      target_username: string | null;
      target_household_id: number | null;
      meta: string | null;
      created_at: string;
    }
  >(
    `SELECT a.id, a.actor_user_id, au.username AS actor_username,
            a.action, a.target_user_id, tu.username AS target_username,
            a.target_household_id, a.meta, a.created_at
       FROM admin_audit_log a
       LEFT JOIN users au ON au.id = a.actor_user_id
       LEFT JOIN users tu ON tu.id = a.target_user_id
      ORDER BY a.created_at DESC
      LIMIT ${Number(limit)}`
  );
}

export async function getUserDetail(userId: number) {
  const user = await queryOne<RowDataPacket & {
    id: number;
    username: string;
    is_admin: number;
    is_banned: number;
    created_at: string;
    last_login_at: string | null;
  }>(
    `SELECT id, username, is_admin, is_banned, created_at, last_login_at FROM users WHERE id = ?`,
    [userId]
  );
  if (!user) return null;
  const households = await query<
    RowDataPacket & { id: number; name: string; role: "owner" | "member" }
  >(
    `SELECT h.id, h.name, m.role
       FROM households h
       JOIN household_members m ON m.household_id = h.id
      WHERE m.user_id = ?
      ORDER BY h.name ASC`,
    [userId]
  );
  return { user, households };
}
