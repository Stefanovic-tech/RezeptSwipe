import { execute, queryOne, type RowDataPacket } from "./db";

interface BucketRow extends RowDataPacket {
  bucket_key: string;
  window_start: string;
  count: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - opts.windowSeconds * 1000);

  const row = await queryOne<BucketRow>(
    "SELECT bucket_key, window_start, count FROM rate_limit_buckets WHERE bucket_key = ?",
    [opts.key]
  );

  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  if (!row) {
    await execute(
      `INSERT INTO rate_limit_buckets (bucket_key, window_start, count) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE count = 1, window_start = VALUES(window_start)`,
      [opts.key, fmt(now)]
    );
    return { ok: true, remaining: opts.limit - 1, retryAfterSeconds: 0 };
  }

  const rowStart = new Date(row.window_start.replace(" ", "T") + "Z");
  if (rowStart < windowStart) {
    await execute(
      "UPDATE rate_limit_buckets SET window_start = ?, count = 1 WHERE bucket_key = ?",
      [fmt(now), opts.key]
    );
    return { ok: true, remaining: opts.limit - 1, retryAfterSeconds: 0 };
  }

  if (row.count >= opts.limit) {
    const retry = Math.max(
      1,
      Math.ceil((rowStart.getTime() + opts.windowSeconds * 1000 - now.getTime()) / 1000)
    );
    return { ok: false, remaining: 0, retryAfterSeconds: retry };
  }

  await execute(
    "UPDATE rate_limit_buckets SET count = count + 1 WHERE bucket_key = ?",
    [opts.key]
  );
  return {
    ok: true,
    remaining: Math.max(0, opts.limit - row.count - 1),
    retryAfterSeconds: 0,
  };
}

export async function clearRateLimit(key: string): Promise<void> {
  await execute("DELETE FROM rate_limit_buckets WHERE bucket_key = ?", [key]);
}
