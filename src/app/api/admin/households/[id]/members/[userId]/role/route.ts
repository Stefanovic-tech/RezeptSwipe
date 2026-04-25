import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi, ApiError } from "@/lib/session";
import { adminSetMemberRole } from "@/lib/admin-households";

const schema = z.object({ role: z.enum(["owner", "member"]) });

export async function POST(
  req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const body = schema.parse(await req.json());
    const householdId = Number(params.id);
    const userId = Number(params.userId);
    if (!Number.isInteger(householdId) || householdId <= 0) {
      throw new ApiError(400, "Ungueltige Haushalts-ID.");
    }
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new ApiError(400, "Ungueltige User-ID.");
    }
    await adminSetMemberRole(admin.id, householdId, userId, body.role);
    return jsonOk({ ok: true });
  });
}
