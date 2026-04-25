import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { listItems } from "@/lib/shopping";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ list: null, items: [] });
    const result = await listItems(user.id, user.currentHouseholdId);
    return jsonOk(result);
  });
}
