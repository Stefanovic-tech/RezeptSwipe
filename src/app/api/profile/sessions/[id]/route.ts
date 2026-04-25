import { handle, jsonOk } from "@/lib/http";
import { requireUser, revokeSessionById } from "@/lib/session";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const user = await requireUser();
    await revokeSessionById(user.id, Number(params.id));
    return jsonOk({ ok: true });
  });
}
