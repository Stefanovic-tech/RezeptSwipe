import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { ensureMembership } from "@/lib/households";
import { setSwipeDecision } from "@/lib/recipes";

const schema = z.object({
  recipeId: z.number().int().positive(),
  status: z.enum(["liked", "passed"]),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) {
      return jsonOk({ ok: false });
    }
    await ensureMembership(user.id, user.currentHouseholdId);
    const body = schema.parse(await req.json());
    await setSwipeDecision(user.id, user.currentHouseholdId, body.recipeId, body.status);
    return jsonOk({ ok: true });
  });
}
