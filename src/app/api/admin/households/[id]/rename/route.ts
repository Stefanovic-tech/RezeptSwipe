import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi, ApiError } from "@/lib/session";
import { adminRenameHousehold } from "@/lib/admin-households";

const schema = z.object({ name: z.string().trim().min(1).max(80) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const body = schema.parse(await req.json());
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Ungueltige ID.");
    await adminRenameHousehold(admin.id, id, body.name);
    return jsonOk({ ok: true });
  });
}
