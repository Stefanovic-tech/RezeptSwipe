import crypto from "node:crypto";
import argon2 from "argon2";
import { createConnection, ensureDatabaseExists } from "./_db.mjs";
import { loadEnv } from "./_env.mjs";

loadEnv();

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

async function ensureAdminUser(conn, username, password) {
  const usernameLower = username.toLowerCase();
  const [existing] = await conn.query(
    "SELECT id, is_admin FROM users WHERE username_lower = ? LIMIT 1",
    [usernameLower]
  );
  if (existing.length > 0) {
    const user = existing[0];
    if (!user.is_admin) {
      await conn.query("UPDATE users SET is_admin = 1 WHERE id = ?", [user.id]);
      console.log(`[bootstrap] User '${username}' zum Admin gemacht.`);
    } else {
      console.log(`[bootstrap] Admin '${username}' existiert bereits.`);
    }
    return user.id;
  }
  if (!password) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD fehlt: Initial-Admin kann nicht angelegt werden."
    );
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const [result] = await conn.query(
    `INSERT INTO users (username, username_lower, password_hash, is_admin)
     VALUES (?, ?, ?, 1)`,
    [username, usernameLower, passwordHash]
  );
  console.log(`[bootstrap] Admin '${username}' angelegt (id=${result.insertId}).`);
  return result.insertId;
}

async function ensureHousehold(conn, name, ownerUserId) {
  const [rows] = await conn.query(
    `SELECT h.id FROM households h
     JOIN household_members m ON m.household_id = h.id AND m.user_id = ?
     WHERE h.name = ?
     LIMIT 1`,
    [ownerUserId, name]
  );
  if (rows.length > 0) {
    console.log(`[bootstrap] Haushalt '${name}' existiert bereits.`);
    return rows[0].id;
  }
  const [result] = await conn.query(
    "INSERT INTO households (name, created_by) VALUES (?, ?)",
    [name, ownerUserId]
  );
  const householdId = result.insertId;
  await conn.query(
    "INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'owner')",
    [householdId, ownerUserId]
  );
  await conn.query(
    "INSERT INTO household_preferences (household_id) VALUES (?)",
    [householdId]
  );
  await conn.query(
    "UPDATE users SET current_household_id = ? WHERE id = ? AND current_household_id IS NULL",
    [householdId, ownerUserId]
  );
  console.log(`[bootstrap] Haushalt '${name}' angelegt (id=${householdId}).`);
  return householdId;
}

async function ensureInvite(conn, householdId, ownerUserId, code) {
  if (!code) {
    console.log("[bootstrap] kein BOOTSTRAP_INVITE_CODE gesetzt, ueberspringe.");
    return;
  }
  const codeHash = sha256Hex(code.toUpperCase());
  const [existing] = await conn.query(
    "SELECT id FROM household_invites WHERE code_hash = ? LIMIT 1",
    [codeHash]
  );
  if (existing.length > 0) {
    console.log(`[bootstrap] Invite-Code existiert bereits.`);
    return;
  }
  await conn.query(
    `INSERT INTO household_invites
       (household_id, code_hash, code_preview, created_by, max_uses)
     VALUES (?, ?, ?, ?, 5)`,
    [householdId, codeHash, code.slice(0, 4) + "...", ownerUserId]
  );
  console.log(`[bootstrap] Invite-Code angelegt (Preview: ${code.slice(0, 4)}...).`);
}

async function maybeForceReset(conn) {
  if (process.env.BOOTSTRAP_FORCE_RESET_DB !== "1") return;
  console.log("[bootstrap] FORCE_RESET aktiv: leere Domaentabellen.");
  const tables = [
    "shopping_list_items",
    "shopping_lists",
    "cooking_session_choices",
    "cooking_sessions",
    "household_recipe_state",
    "household_invites",
    "household_preferences",
    "household_members",
    "user_recovery_codes",
    "refresh_sessions",
    "admin_audit_log",
  ];
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of tables) {
    await conn.query(`TRUNCATE TABLE ${t}`);
  }
  await conn.query("UPDATE users SET current_household_id = NULL");
  await conn.query("DELETE FROM households");
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("[bootstrap] Reset abgeschlossen.");
}

async function main() {
  await ensureDatabaseExists();
  const conn = await createConnection();
  try {
    await maybeForceReset(conn);
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME || "admin";
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
    const householdName = process.env.BOOTSTRAP_HOUSEHOLD_NAME || "Haushalt";
    const inviteCode = process.env.BOOTSTRAP_INVITE_CODE || "";

    const adminId = await ensureAdminUser(conn, username, password);
    const householdId = await ensureHousehold(conn, householdName, adminId);
    await ensureInvite(conn, householdId, adminId, inviteCode);
    console.log("[bootstrap] fertig.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[bootstrap] Fehler:", err.message);
  process.exit(1);
});
