import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { cancelCookingSession } from "@/lib/cooking";

const schema = z.object({ sessionId: z.number().int().positive() });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    const body = schema.parse(await req.json());
    await cancelCookingSession(user.id, user.currentHouseholdId, body.sessionId);
    return jsonOk({ ok: true });
  });
}
