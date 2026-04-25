import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { decideCandidate } from "@/lib/cooking";

const schema = z.object({
  sessionId: z.number().int().positive(),
  recipeId: z.number().int().positive(),
  accepted: z.boolean(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    const body = schema.parse(await req.json());
    const result = await decideCandidate(
      user.id,
      user.currentHouseholdId,
      body.sessionId,
      body.recipeId,
      body.accepted
    );
    return jsonOk(result);
  });
}
