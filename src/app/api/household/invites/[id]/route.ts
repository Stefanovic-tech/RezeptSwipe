import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { revokeInvite } from "@/lib/households";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const user = await requireUserForApi();
    await revokeInvite(user.id, Number(params.id));
    return jsonOk({ ok: true });
  });
}
