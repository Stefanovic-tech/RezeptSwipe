import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi, ApiError } from "@/lib/session";
import { adminRevokeInvite } from "@/lib/admin-households";

export async function POST(
  _req: Request,
  { params }: { params: { id: string; inviteId: string } }
) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const inviteId = Number(params.inviteId);
    if (!Number.isInteger(inviteId) || inviteId <= 0) {
      throw new ApiError(400, "Ungueltige Invite-ID.");
    }
    await adminRevokeInvite(admin.id, inviteId);
    return jsonOk({ ok: true });
  });
}
