import { handle, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { listItems } from "@/lib/shopping";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    if (!user.currentHouseholdId) return jsonOk({ list: null, items: [] });
    const result = await listItems(user.id, user.currentHouseholdId);
    return jsonOk(result);
  });
}
