import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi } from "@/lib/session";
import {
  adminDeleteHousehold,
  getHouseholdAdminDetail,
  verifyAdminPassword,
} from "@/lib/admin-households";
import { ApiError } from "@/lib/session";

export const dynamic = "force-dynamic";

const deleteSchema = z.object({
  confirmName: z.string().min(1),
  password: z.string().min(1),
});

function parseId(id: string): number {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, "Ungueltige ID.");
  return n;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdminForApi();
    const detail = await getHouseholdAdminDetail(parseId(params.id));
    if (!detail) throw new ApiError(404, "Haushalt nicht gefunden.");
    return jsonOk(detail);
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const body = deleteSchema.parse(await req.json());
    const id = parseId(params.id);
    await verifyAdminPassword(admin.id, body.password);
    const detail = await getHouseholdAdminDetail(id);
    if (!detail) throw new ApiError(404, "Haushalt nicht gefunden.");
    if (detail.name.trim() !== body.confirmName.trim()) {
      throw new ApiError(400, "Bestaetigungsname stimmt nicht ueberein.");
    }
    const result = await adminDeleteHousehold(admin.id, id);
    return jsonOk(result);
  });
}
