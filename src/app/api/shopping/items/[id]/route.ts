import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { deleteItem, setItemChecked } from "@/lib/shopping";

const schema = z.object({ checked: z.boolean() });

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    const body = schema.parse(await req.json());
    await setItemChecked(user.id, user.currentHouseholdId, Number(params.id), body.checked);
    return jsonOk({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    await deleteItem(user.id, user.currentHouseholdId, Number(params.id));
    return jsonOk({ ok: true });
  });
}
