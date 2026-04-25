import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { transferOwnership } from "@/lib/households";

const schema = z.object({ newOwnerUserId: z.number().int().positive() });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    const body = schema.parse(await req.json());
    await transferOwnership(user.id, user.currentHouseholdId, body.newOwnerUserId);
    return jsonOk({ ok: true });
  });
}
