import mysql from "mysql2/promise";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: Pool | undefined;
}

function createPool(): Pool {
  return mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    connectionLimit: 10,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    waitForConnections: true,
    namedPlaceholders: false,
    charset: "utf8mb4_unicode_ci",
    dateStrings: true,
  });
}

export function getPool(): Pool {
  if (!global.__mysqlPool) {
    global.__mysqlPool = createPool();
  }
  return global.__mysqlPool;
}

export async function query<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await getPool().query<T[]>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<ResultSetHeader> {
  const [result] = await getPool().query<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    conn.release();
  }
}

export type { RowDataPacket, ResultSetHeader };
