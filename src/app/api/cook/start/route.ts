import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { startCookingSession } from "@/lib/cooking";

const schema = z.object({
  effort: z.enum(["quick", "normal", "elaborate", "any"]).default("any"),
  maxMinutes: z.union([z.number().int().positive(), z.null()]).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    const body = schema.parse(await req.json());
    const session = await startCookingSession(user.id, user.currentHouseholdId, {
      effort: body.effort,
      maxMinutes: body.maxMinutes ?? null,
    });
    return jsonOk({ session });
  });
}
