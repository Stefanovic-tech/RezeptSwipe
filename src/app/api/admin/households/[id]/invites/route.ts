import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi, ApiError } from "@/lib/session";
import { adminCreateInviteForHousehold } from "@/lib/admin-households";

const schema = z.object({
  maxUses: z.number().int().positive().max(50).optional(),
  expiresInDays: z.union([z.number().int().positive(), z.null()]).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const body = schema.parse(await req.json());
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Ungueltige ID.");
    const result = await adminCreateInviteForHousehold(admin.id, id, {
      maxUses: body.maxUses ?? 1,
      expiresInDays: body.expiresInDays ?? null,
    });
    return jsonOk(result);
  });
}
