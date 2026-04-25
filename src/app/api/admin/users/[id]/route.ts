import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi } from "@/lib/session";
import { deleteUser } from "@/lib/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const result = await deleteUser(admin.id, Number(params.id));
    return jsonOk(result);
  });
}
