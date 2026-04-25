import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { createInvite } from "@/lib/households";

const schema = z.object({
  maxUses: z.number().int().positive().max(50).optional(),
  expiresInDays: z.union([z.number().int().positive(), z.null()]).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    const body = schema.parse(await req.json());
    const result = await createInvite(user.id, user.currentHouseholdId, {
      maxUses: body.maxUses ?? 1,
      expiresInDays: body.expiresInDays ?? null,
    });
    return jsonOk(result);
  });
}
