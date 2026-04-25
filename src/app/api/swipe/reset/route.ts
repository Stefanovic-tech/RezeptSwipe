import { handle, jsonOk } from "@/lib/http";
import { ApiError, requireUserForApi } from "@/lib/session";
import { ensureMembership } from "@/lib/households";
import { resetGlobalSwipeDecisions } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) {
      throw new ApiError(400, "Kein Haushalt ausgewaehlt.");
    }
    await ensureMembership(user.id, user.currentHouseholdId);
    await resetGlobalSwipeDecisions(user.currentHouseholdId);
    return jsonOk({ ok: true });
  });
}
