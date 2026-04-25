import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { ensureMembership, setPreferences } from "@/lib/households";

const schema = z.object({
  vegetarian: z.boolean(),
  vegan: z.boolean(),
  no_pork: z.boolean(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    await ensureMembership(user.id, user.currentHouseholdId);
    const body = schema.parse(await req.json());
    await setPreferences(user.currentHouseholdId, body);
    return jsonOk({ ok: true });
  });
}
