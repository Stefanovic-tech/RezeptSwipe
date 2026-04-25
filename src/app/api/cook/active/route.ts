import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { getActiveCookingSession } from "@/lib/cooking";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ session: null });
    const session = await getActiveCookingSession(user.currentHouseholdId);
    return jsonOk({ session });
  });
}
