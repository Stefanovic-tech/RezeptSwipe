import { handle, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { finishList } from "@/lib/shopping";

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    await finishList(user.id, user.currentHouseholdId);
    return jsonOk({ ok: true });
  });
}
