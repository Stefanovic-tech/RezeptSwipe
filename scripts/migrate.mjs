import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "./_env.mjs";
import { createConnection, ensureDatabaseExists } from "./_db.mjs";

const MIGRATIONS_DIR = path.join(ROOT_DIR, "migrations");
const TABLE_NAME = "schema_migrations";

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  const files = fs.readdirSync(MIGRATIONS_DIR).sort();
  const upFiles = files.filter((f) => f.endsWith(".up.sql"));
  return upFiles.map((up) => {
    const id = up.replace(/\.up\.sql$/, "");
    const downFile = `${id}.down.sql`;
    return {
      id,
      upPath: path.join(MIGRATIONS_DIR, up),
      downPath: fs.existsSync(path.join(MIGRATIONS_DIR, downFile))
        ? path.join(MIGRATIONS_DIR, downFile)
        : null,
    };
  });
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id VARCHAR(120) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function getApplied(conn) {
  const [rows] = await conn.query(
    `SELECT id FROM ${TABLE_NAME} ORDER BY id ASC`
  );
  return new Set(rows.map((r) => r.id));
}

async function runUp() {
  await ensureDatabaseExists();
  const conn = await createConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getApplied(conn);
    const all = listMigrations();
    const pending = all.filter((m) => !applied.has(m.id));
    if (pending.length === 0) {
      console.log("[migrate] keine ausstehenden Migrationen.");
      return;
    }
    for (const m of pending) {
      console.log(`[migrate] up: ${m.id}`);
      const sql = fs.readFileSync(m.upPath, "utf8");
      await conn.query(sql);
      await conn.query(`INSERT INTO ${TABLE_NAME} (id) VALUES (?)`, [m.id]);
      console.log(`[migrate] ok:  ${m.id}`);
    }
    console.log("[migrate] fertig.");
  } finally {
    await conn.end();
  }
}

async function runDown() {
  await ensureDatabaseExists();
  const conn = await createConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getApplied(conn);
    const all = listMigrations();
    const lastApplied = [...all].reverse().find((m) => applied.has(m.id));
    if (!lastApplied) {
      console.log("[migrate] nichts zu rollback.");
      return;
    }
    if (!lastApplied.downPath) {
      throw new Error(`[migrate] keine Down-Datei fuer ${lastApplied.id}`);
    }
    console.log(`[migrate] down: ${lastApplied.id}`);
    const sql = fs.readFileSync(lastApplied.downPath, "utf8");
    await conn.query(sql);
    await conn.query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [lastApplied.id]);
    console.log(`[migrate] rolled back: ${lastApplied.id}`);
  } finally {
    await conn.end();
  }
}

async function runStatus() {
  await ensureDatabaseExists();
  const conn = await createConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getApplied(conn);
    const all = listMigrations();
    if (all.length === 0) {
      console.log("[migrate] keine Migrationsdateien gefunden.");
      return;
    }
    for (const m of all) {
      const flag = applied.has(m.id) ? "x" : " ";
      console.log(`[${flag}] ${m.id}`);
    }
  } finally {
    await conn.end();
  }
}

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [name]
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function markId(id) {
  await ensureDatabaseExists();
  const conn = await createConnection();
  try {
    await ensureMigrationsTable(conn);
    const all = listMigrations();
    if (!all.find((m) => m.id === id)) {
      throw new Error(`Migration nicht gefunden: ${id}`);
    }
    await conn.query(
      `INSERT IGNORE INTO ${TABLE_NAME} (id) VALUES (?)`,
      [id]
    );
    console.log(`[migrate] markiert als angewendet: ${id}`);
  } finally {
    await conn.end();
  }
}

async function unmarkId(id) {
  await ensureDatabaseExists();
  const conn = await createConnection();
  try {
    await ensureMigrationsTable(conn);
    await conn.query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    console.log(`[migrate] markierung entfernt: ${id}`);
  } finally {
    await conn.end();
  }
}

// Detektiert vorhandene Schemata und markiert passende Migrationen als
// angewendet. Praktisch, wenn die DB schon manuell aufgesetzt wurde.
async function runBaseline() {
  await ensureDatabaseExists();
  const conn = await createConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getApplied(conn);

    if (!applied.has("001_initial_schema")) {
      if (await tableExists(conn, "users")) {
        await conn.query(
          `INSERT IGNORE INTO ${TABLE_NAME} (id) VALUES ('001_initial_schema')`
        );
        console.log(
          "[baseline] users-Tabelle vorhanden -> 001_initial_schema als angewendet markiert."
        );
      } else {
        console.log("[baseline] users-Tabelle fehlt -> nichts zu baselinen.");
      }
    } else {
      console.log("[baseline] 001_initial_schema bereits markiert.");
    }

    if (!applied.has("002_custom_recipes")) {
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS c
           FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = 'recipe_cache'
            AND column_name = 'household_id'`
      );
      if (Number(rows[0]?.c ?? 0) > 0) {
        await conn.query(
          `INSERT IGNORE INTO ${TABLE_NAME} (id) VALUES ('002_custom_recipes')`
        );
        console.log(
          "[baseline] recipe_cache.household_id vorhanden -> 002_custom_recipes als angewendet markiert."
        );
      }
    }

    console.log("[baseline] fertig. Status mit 'npm run migrate:status' pruefen.");
  } finally {
    await conn.end();
  }
}

const cmd = process.argv[2] || "up";
const arg = process.argv[3];

(async () => {
  try {
    if (cmd === "up") await runUp();
    else if (cmd === "down") await runDown();
    else if (cmd === "status") await runStatus();
    else if (cmd === "baseline") await runBaseline();
    else if (cmd === "mark") {
      if (!arg) throw new Error("Bitte Migration-ID angeben: mark <id>");
      await markId(arg);
    } else if (cmd === "unmark") {
      if (!arg) throw new Error("Bitte Migration-ID angeben: unmark <id>");
      await unmarkId(arg);
    } else {
      console.error(
        `Unbekannter Befehl: ${cmd}. Erlaubt: up | down | status | baseline | mark <id> | unmark <id>`
      );
      process.exit(2);
    }
  } catch (err) {
    console.error("[migrate] Fehler:", err.message);
    process.exit(1);
  }
})();
