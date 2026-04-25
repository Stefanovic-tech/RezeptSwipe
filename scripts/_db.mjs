import mysql from "mysql2/promise";
import { loadEnv, requireEnv } from "./_env.mjs";

loadEnv();

export async function createConnection({ withDatabase = true } = {}) {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number(process.env.DB_PORT || 3306);
  const user = requireEnv("DB_USER");
  const password = process.env.DB_PASSWORD ?? "";
  const database = withDatabase ? requireEnv("DB_NAME") : undefined;

  return mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    charset: "utf8mb4_unicode_ci",
  });
}

export async function ensureDatabaseExists() {
  const dbName = requireEnv("DB_NAME");
  const conn = await createConnection({ withDatabase: false });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}
