import { handle, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { leaveHousehold } from "@/lib/households";

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    await leaveHousehold(user.id, user.currentHouseholdId);
    return jsonOk({ ok: true });
  });
}
