import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi } from "@/lib/session";
import { adminCreateInvite } from "@/lib/admin";

const schema = z.object({
  householdId: z.number().int().positive(),
  maxUses: z.number().int().positive().max(50).optional(),
  expiresInDays: z.union([z.number().int().positive(), z.null()]).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const body = schema.parse(await req.json());
    const result = await adminCreateInvite(admin.id, body.householdId, {
      maxUses: body.maxUses ?? 1,
      expiresInDays: body.expiresInDays ?? null,
    });
    return jsonOk(result);
  });
}
