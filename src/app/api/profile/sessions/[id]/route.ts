import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi, revokeSessionById } from "@/lib/session";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const user = await requireUserForApi();
    await revokeSessionById(user.id, Number(params.id));
    return jsonOk({ ok: true });
  });
}
