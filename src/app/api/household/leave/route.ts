import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { leaveHousehold } from "@/lib/households";

export async function POST() {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    await leaveHousehold(user.id, user.currentHouseholdId);
    return jsonOk({ ok: true });
  });
}
