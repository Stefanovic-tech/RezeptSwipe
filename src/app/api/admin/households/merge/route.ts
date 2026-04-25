import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi, ApiError } from "@/lib/session";
import { adminMergeHouseholds, verifyAdminPassword } from "@/lib/admin-households";

const schema = z.object({
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
  confirmSourceName: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const body = schema.parse(await req.json());
    if (body.sourceId === body.targetId) {
      throw new ApiError(400, "Quell- und Ziel-Haushalt muessen unterschiedlich sein.");
    }
    await verifyAdminPassword(admin.id, body.password);

    const { getHouseholdAdminDetail } = await import("@/lib/admin-households");
    const sourceDetail = await getHouseholdAdminDetail(body.sourceId);
    if (!sourceDetail) throw new ApiError(404, "Quell-Haushalt nicht gefunden.");
    if (sourceDetail.name.trim() !== body.confirmSourceName.trim()) {
      throw new ApiError(400, "Bestaetigungsname stimmt nicht mit Quell-Haushalt ueberein.");
    }

    const result = await adminMergeHouseholds(admin.id, body.sourceId, body.targetId);
    return jsonOk(result);
  });
}
