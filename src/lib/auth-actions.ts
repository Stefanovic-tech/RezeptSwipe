import { z } from "zod";
import { execute, query, queryOne, withTransaction, type RowDataPacket } from "./db";
import {
  generateRecoveryCodes,
  hashPassword,
  normalizeInviteCode,
  normalizeRecoveryCode,
  sha256Hex,
  verifyPassword,
} from "./hash";
import { checkRateLimit } from "./rate-limit";
import {
  ApiError,
  createSessionForUser,
  persistSessionCookies,
  revokeAllSessionsForUser,
} from "./session";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Benutzername muss mindestens 3 Zeichen haben.")
  .max(32, "Benutzername darf hoechstens 32 Zeichen haben.")
  .regex(/^[a-zA-Z0-9._-]+$/, "Nur Buchstaben, Ziffern und . _ - erlaubt.");

export const passwordSchema = z
  .string()
  .min(8, "Passwort muss mindestens 8 Zeichen haben.")
  .max(200, "Passwort ist zu lang.");

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  username_lower: string;
  password_hash: string;
  is_admin: number;
  is_banned: number;
  current_household_id: number | null;
}

interface InviteRow extends RowDataPacket {
  id: number;
  household_id: number;
  max_uses: number;
  used_count: number;
  revoked_at: string | null;
  expires_at: string | null;
}

async function findUserByUsername(username: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT id, username, username_lower, password_hash, is_admin, is_banned, current_household_id
     FROM users WHERE username_lower = ? LIMIT 1`,
    [username.toLowerCase()]
  );
}

async function ensureInviteUsable(code: string): Promise<InviteRow> {
  const codeHash = sha256Hex(normalizeInviteCode(code));
  const invite = await queryOne<InviteRow>(
    `SELECT id, household_id, max_uses, used_count, revoked_at, expires_at
     FROM household_invites WHERE code_hash = ? LIMIT 1`,
    [codeHash]
  );
  if (!invite) throw new ApiError(400, "Invite-Code ist ungueltig.");
  if (invite.revoked_at) throw new ApiError(400, "Invite-Code wurde widerrufen.");
  if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
    throw new ApiError(400, "Invite-Code ist abgelaufen.");
  }
  if (invite.used_count >= invite.max_uses) {
    throw new ApiError(400, "Invite-Code wurde bereits maximal genutzt.");
  }
  return invite;
}

export async function rateLimitLogin(username: string, ip: string | null) {
  const subject = `${ip ?? "unknown"}|${username.toLowerCase()}`;
  const result = await checkRateLimit({
    key: `login:${subject}`,
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!result.ok) {
    throw new ApiError(
      429,
      `Zu viele Login-Versuche. Bitte in ${result.retryAfterSeconds}s erneut versuchen.`
    );
  }
}

export async function rateLimitInvite(ip: string | null) {
  const result = await checkRateLimit({
    key: `invite:${ip ?? "unknown"}`,
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (!result.ok) {
    throw new ApiError(
      429,
      `Zu viele Invite-Versuche. Bitte in ${result.retryAfterSeconds}s erneut versuchen.`
    );
  }
}

export async function loginUser(
  username: string,
  password: string,
  ctx: { ip: string | null; userAgent: string | null }
) {
  await rateLimitLogin(username, ctx.ip);
  const user = await findUserByUsername(username);
  if (!user) {
    throw new ApiError(401, "Benutzername oder Passwort falsch.");
  }
  if (user.is_banned === 1) {
    throw new ApiError(403, "Konto ist gesperrt.");
  }
  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) {
    throw new ApiError(401, "Benutzername oder Passwort falsch.");
  }

  const session = await createSessionForUser(user.id, {
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
  await persistSessionCookies(session.accessToken, session.refreshToken);
  return session.user;
}

export interface RegisterResult {
  username: string;
  recoveryCodes: string[];
}

export async function registerUserWithInvite(
  inviteCode: string,
  username: string,
  password: string,
  ctx: { ip: string | null; userAgent: string | null }
): Promise<RegisterResult> {
  await rateLimitInvite(ctx.ip);

  const cleanUsername = username.trim();
  const usernameLower = cleanUsername.toLowerCase();

  const existing = await findUserByUsername(cleanUsername);
  if (existing) {
    throw new ApiError(409, "Benutzername ist bereits vergeben.");
  }

  const passwordHash = await hashPassword(password);
  const recoveryCodes = generateRecoveryCodes();

  const userId = await withTransaction(async (conn) => {
    const codeHash = sha256Hex(normalizeInviteCode(inviteCode));
    const [inviteRows] = await conn.query<InviteRow[]>(
      `SELECT id, household_id, max_uses, used_count, revoked_at, expires_at
       FROM household_invites WHERE code_hash = ? LIMIT 1 FOR UPDATE`,
      [codeHash]
    );
    const invite = inviteRows[0];
    if (!invite) throw new ApiError(400, "Invite-Code ist ungueltig.");
    if (invite.revoked_at) throw new ApiError(400, "Invite-Code wurde widerrufen.");
    if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
      throw new ApiError(400, "Invite-Code ist abgelaufen.");
    }
    if (invite.used_count >= invite.max_uses) {
      throw new ApiError(400, "Invite-Code wurde bereits maximal genutzt.");
    }

    const [userResult] = await conn.query<import("mysql2/promise").ResultSetHeader>(
      `INSERT INTO users (username, username_lower, password_hash, current_household_id)
       VALUES (?, ?, ?, ?)`,
      [cleanUsername, usernameLower, passwordHash, invite.household_id]
    );
    const newUserId = userResult.insertId;

    await conn.query(
      `INSERT INTO household_members (household_id, user_id, role)
       VALUES (?, ?, 'member')`,
      [invite.household_id, newUserId]
    );

    await conn.query(
      "UPDATE household_invites SET used_count = used_count + 1 WHERE id = ?",
      [invite.id]
    );

    for (const code of recoveryCodes) {
      const codeHashForUser = sha256Hex(normalizeRecoveryCode(code));
      await conn.query(
        "INSERT INTO user_recovery_codes (user_id, code_hash) VALUES (?, ?)",
        [newUserId, codeHashForUser]
      );
    }

    return newUserId;
  });

  const session = await createSessionForUser(userId, {
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
  await persistSessionCookies(session.accessToken, session.refreshToken);

  return { username: cleanUsername, recoveryCodes };
}

export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const user = await queryOne<UserRow>(
    "SELECT id, password_hash FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  if (!user) throw new ApiError(404, "Nutzer nicht gefunden.");
  const ok = await verifyPassword(user.password_hash, oldPassword);
  if (!ok) throw new ApiError(401, "Aktuelles Passwort falsch.");
  const newHash = await hashPassword(newPassword);
  await execute("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, userId]);
  await revokeAllSessionsForUser(userId);
}

export async function changeUsername(
  userId: number,
  newUsername: string
): Promise<{ username: string }> {
  const cleanUsername = newUsername.trim();
  const usernameLower = cleanUsername.toLowerCase();
  const existing = await queryOne<UserRow>(
    "SELECT id FROM users WHERE username_lower = ? AND id <> ? LIMIT 1",
    [usernameLower, userId]
  );
  if (existing) throw new ApiError(409, "Benutzername ist bereits vergeben.");
  await execute(
    "UPDATE users SET username = ?, username_lower = ? WHERE id = ?",
    [cleanUsername, usernameLower, userId]
  );
  return { username: cleanUsername };
}

export async function resetPasswordWithRecoveryCode(
  username: string,
  recoveryCode: string,
  newPassword: string
): Promise<void> {
  const user = await findUserByUsername(username);
  if (!user) throw new ApiError(401, "Angaben ungueltig.");
  const codeHash = sha256Hex(normalizeRecoveryCode(recoveryCode));
  const code = await queryOne<RowDataPacket & { id: number; used_at: string | null }>(
    `SELECT id, used_at FROM user_recovery_codes
     WHERE user_id = ? AND code_hash = ? LIMIT 1`,
    [user.id, codeHash]
  );
  if (!code || code.used_at) throw new ApiError(401, "Angaben ungueltig.");

  const newHash = await hashPassword(newPassword);
  await withTransaction(async (conn) => {
    await conn.query(
      "UPDATE user_recovery_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
      [code.id]
    );
    await conn.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, user.id]);
    await conn.query(
      "UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
      [user.id]
    );
  });
}

export async function regenerateRecoveryCodes(userId: number): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await withTransaction(async (conn) => {
    await conn.query("DELETE FROM user_recovery_codes WHERE user_id = ?", [userId]);
    for (const code of codes) {
      const codeHash = sha256Hex(normalizeRecoveryCode(code));
      await conn.query(
        "INSERT INTO user_recovery_codes (user_id, code_hash) VALUES (?, ?)",
        [userId, codeHash]
      );
    }
  });
  return codes;
}

export async function listUserHouseholds(userId: number) {
  return query<
    RowDataPacket & { id: number; name: string; role: "owner" | "member"; member_count: number }
  >(
    `SELECT h.id, h.name, m.role,
            (SELECT COUNT(*) FROM household_members WHERE household_id = h.id) AS member_count
     FROM households h
     JOIN household_members m ON m.household_id = h.id
     WHERE m.user_id = ?
     ORDER BY h.name ASC`,
    [userId]
  );
}
