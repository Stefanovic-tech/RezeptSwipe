import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";
import { execute, query, queryOne, withTransaction, type RowDataPacket } from "./db";
import { randomToken, sha256Hex } from "./hash";
import { signAccessToken, verifyAccessToken, type AccessClaims } from "./jwt";

export const ACCESS_COOKIE = "rs_access";
export const REFRESH_COOKIE = "rs_refresh";

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  is_admin: number;
  is_banned: number;
  current_household_id: number | null;
}

export interface SessionUser {
  id: number;
  username: string;
  isAdmin: boolean;
  currentHouseholdId: number | null;
}

interface RefreshSessionRow extends RowDataPacket {
  id: number;
  user_id: number;
  expires_at: string;
  revoked_at: string | null;
  rotated_to_id: number | null;
}

function cookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: env.auth.cookieSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

function refreshTtlSeconds(): number {
  return env.auth.refreshTtlDays * 24 * 60 * 60;
}

function accessTtlSeconds(): number {
  return env.auth.accessTtlMinutes * 60;
}

async function setAccessCookie(token: string) {
  cookies().set(ACCESS_COOKIE, token, cookieOptions(accessTtlSeconds()));
}

async function setRefreshCookie(token: string) {
  cookies().set(REFRESH_COOKIE, token, cookieOptions(refreshTtlSeconds()));
}

export function clearAuthCookies() {
  cookies().set(ACCESS_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  cookies().set(REFRESH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}

async function loadUserById(userId: number): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT id, username, is_admin, is_banned, current_household_id
     FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
}

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    isAdmin: row.is_admin === 1,
    currentHouseholdId: row.current_household_id,
  };
}

async function issueAccessToken(user: UserRow): Promise<string> {
  const claims: AccessClaims = {
    sub: String(user.id),
    isAdmin: user.is_admin === 1,
    hh: user.current_household_id ?? null,
    username: user.username,
  };
  return signAccessToken(claims);
}

interface CreateSessionContext {
  userAgent?: string | null;
  ipAddress?: string | null;
  deviceLabel?: string | null;
}

export async function createSessionForUser(
  userId: number,
  ctx: CreateSessionContext = {}
): Promise<{ accessToken: string; refreshToken: string; user: SessionUser }> {
  const user = await loadUserById(userId);
  if (!user) throw new Error("User not found");
  if (user.is_banned === 1) throw new Error("User is banned");

  const refreshToken = randomToken(48);
  const refreshHash = sha256Hex(refreshToken);
  const expiresAt = new Date(Date.now() + refreshTtlSeconds() * 1000);

  await execute(
    `INSERT INTO refresh_sessions
       (user_id, token_hash, device_label, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      refreshHash,
      ctx.deviceLabel ?? null,
      ctx.userAgent ?? null,
      ctx.ipAddress ?? null,
      expiresAt.toISOString().slice(0, 19).replace("T", " "),
    ]
  );

  await execute(
    "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
    [userId]
  );

  const accessToken = await issueAccessToken(user);
  return { accessToken, refreshToken, user: toSessionUser(user) };
}

export async function persistSessionCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await setAccessCookie(accessToken);
  await setRefreshCookie(refreshToken);
}

interface RotationResult {
  ok: true;
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

type RotationFailure =
  | { ok: false; reason: "missing" | "invalid" | "expired" | "revoked" | "reused" | "banned" };

export async function rotateRefreshToken(
  presented: string,
  ctx: CreateSessionContext = {}
): Promise<RotationResult | RotationFailure> {
  if (!presented) return { ok: false, reason: "missing" };
  const presentedHash = sha256Hex(presented);

  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RefreshSessionRow[]>(
      `SELECT id, user_id, expires_at, revoked_at, rotated_to_id
       FROM refresh_sessions WHERE token_hash = ? LIMIT 1 FOR UPDATE`,
      [presentedHash]
    );
    const row = rows[0];
    if (!row) return { ok: false as const, reason: "invalid" as const };

    if (row.revoked_at) {
      // Reuse-Detection: alle Sessions des Users invalidieren
      await conn.query(
        `UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND revoked_at IS NULL`,
        [row.user_id]
      );
      return { ok: false as const, reason: "reused" as const };
    }
    if (new Date(row.expires_at) <= new Date()) {
      return { ok: false as const, reason: "expired" as const };
    }

    const [users] = await conn.query<UserRow[]>(
      `SELECT id, username, is_admin, is_banned, current_household_id
       FROM users WHERE id = ? LIMIT 1`,
      [row.user_id]
    );
    const user = users[0];
    if (!user) return { ok: false as const, reason: "invalid" as const };
    if (user.is_banned === 1) return { ok: false as const, reason: "banned" as const };

    const newRefreshToken = randomToken(48);
    const newRefreshHash = sha256Hex(newRefreshToken);
    const expiresAt = new Date(Date.now() + refreshTtlSeconds() * 1000);

    const [insertResult] = await conn.query<import("mysql2/promise").ResultSetHeader>(
      `INSERT INTO refresh_sessions
         (user_id, token_hash, device_label, user_agent, ip_address, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        newRefreshHash,
        ctx.deviceLabel ?? null,
        ctx.userAgent ?? null,
        ctx.ipAddress ?? null,
        expiresAt.toISOString().slice(0, 19).replace("T", " "),
      ]
    );

    await conn.query(
      `UPDATE refresh_sessions
         SET revoked_at = CURRENT_TIMESTAMP,
             rotated_to_id = ?,
             last_used_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [insertResult.insertId, row.id]
    );

    const accessToken = await issueAccessToken(user);
    return {
      ok: true as const,
      accessToken,
      refreshToken: newRefreshToken,
      user: toSessionUser(user),
    };
  });
}

export async function revokeRefreshTokenByValue(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = sha256Hex(token);
  await execute(
    `UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash]
  );
}

export async function revokeAllSessionsForUser(userId: number): Promise<void> {
  await execute(
    `UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND revoked_at IS NULL`,
    [userId]
  );
}

async function tryFromAccessCookie(): Promise<SessionUser | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  if (!claims?.sub) return null;
  const userId = Number(claims.sub);
  if (!Number.isFinite(userId)) return null;
  const user = await loadUserById(userId);
  if (!user || user.is_banned === 1) return null;
  return toSessionUser(user);
}

/**
 * Nur Access-Cookie (JWT). Kein Refresh, keine Cookie-Mutation —
 * darf in Server Components, Layouts und Pages verwendet werden.
 * Refresh passiert in Middleware (/api/auth/refresh) oder in Route Handlern.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return tryFromAccessCookie();
}

/**
 * Refresh-Rotation + Set-Cookie. Nur in Route Handlern oder Server Actions aufrufen.
 */
export async function tryRefreshSessionCookies(): Promise<SessionUser | null> {
  const refresh = cookies().get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  const ipAddress = headers().get("x-forwarded-for") ?? headers().get("x-real-ip");
  const userAgent = headers().get("user-agent");

  const result = await rotateRefreshToken(refresh, {
    userAgent: userAgent ?? null,
    ipAddress: ipAddress?.split(",")[0]?.trim() ?? null,
  });

  if (!result.ok) {
    clearAuthCookies();
    return null;
  }

  await setAccessCookie(result.accessToken);
  await setRefreshCookie(result.refreshToken);
  return result.user;
}

/** Session mit Refresh; nur fuer API-Route-Handler. */
export async function requireUserForApi(): Promise<SessionUser> {
  let user = await getCurrentUser();
  if (!user) user = await tryRefreshSessionCookies();
  if (!user) throw new ApiError(401, "Nicht angemeldet.");
  return user;
}

export async function requireAdminForApi(): Promise<SessionUser> {
  const user = await requireUserForApi();
  if (!user.isAdmin) throw new ApiError(403, "Adminrechte erforderlich.");
  return user;
}

/**
 * Fuer Server Components: Access-JWT; falls abgelaufen aber Refresh-Cookie da,
 * Redirect auf /api/auth/refresh (Cookie-Mutation nur dort).
 * Middleware setzt x-pathname fuer ?next=.
 */
export function redirectIfNoSessionButMaybeRefreshable(): never {
  if (cookies().get(REFRESH_COOKIE)?.value) {
    const nextPath = headers().get("x-pathname") || "/swipe";
    redirect(`/api/auth/refresh?next=${encodeURIComponent(nextPath)}`);
  }
  redirect("/login");
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirectIfNoSessionButMaybeRefreshable();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ApiError(403, "Adminrechte erforderlich.");
  return user;
}

/** API /me: Access oder einmal Refresh. */
export async function getSessionUserAllowingRefresh(): Promise<SessionUser | null> {
  const direct = await getCurrentUser();
  if (direct) return direct;
  return tryRefreshSessionCookies();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function listSessionsForUser(userId: number): Promise<
  Array<{
    id: number;
    deviceLabel: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string;
    isCurrent: boolean;
  }>
> {
  const presented = cookies().get(REFRESH_COOKIE)?.value;
  const presentedHash = presented ? sha256Hex(presented) : null;
  const rows = await query<
    RowDataPacket & {
      id: number;
      device_label: string | null;
      user_agent: string | null;
      ip_address: string | null;
      created_at: string;
      last_used_at: string | null;
      expires_at: string;
      token_hash: string;
    }
  >(
    `SELECT id, device_label, user_agent, ip_address, created_at, last_used_at, expires_at, token_hash
     FROM refresh_sessions
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    deviceLabel: r.device_label,
    userAgent: r.user_agent,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at,
    isCurrent: presentedHash !== null && r.token_hash === presentedHash,
  }));
}

export async function revokeSessionById(userId: number, sessionId: number): Promise<void> {
  await execute(
    `UPDATE refresh_sessions
        SET revoked_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    [sessionId, userId]
  );
}
