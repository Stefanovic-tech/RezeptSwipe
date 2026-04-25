import { z } from "zod";
import { execute } from "@/lib/db";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { ensureOwner } from "@/lib/households";

const schema = z.object({ name: z.string().trim().min(1).max(80) });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    await ensureOwner(user.id, user.currentHouseholdId);
    const body = schema.parse(await req.json());
    await execute("UPDATE households SET name = ? WHERE id = ?", [
      body.name,
      user.currentHouseholdId,
    ]);
    return jsonOk({ ok: true });
  });
}
