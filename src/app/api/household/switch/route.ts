import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { switchCurrentHousehold } from "@/lib/households";

const schema = z.object({ householdId: z.number().int().positive() });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    await switchCurrentHousehold(user.id, body.householdId);
    return jsonOk({ ok: true });
  });
}
