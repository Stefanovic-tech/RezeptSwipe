import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi, ApiError } from "@/lib/session";
import { adminTransferOwnership, verifyAdminPassword } from "@/lib/admin-households";

const schema = z.object({
  newOwnerUserId: z.number().int().positive(),
  password: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const body = schema.parse(await req.json());
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Ungueltige ID.");
    await verifyAdminPassword(admin.id, body.password);
    await adminTransferOwnership(admin.id, id, body.newOwnerUserId);
    return jsonOk({ ok: true });
  });
}
