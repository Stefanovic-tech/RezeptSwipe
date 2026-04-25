import { NextResponse } from "next/server";
import { queryOne, type RowDataPacket } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const row = await queryOne<RowDataPacket & { ok: number }>("SELECT 1 AS ok");
    if (!row || row.ok !== 1) throw new Error("db check failed");
    return NextResponse.json({ status: "ok", db: true });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        db: false,
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }
}
