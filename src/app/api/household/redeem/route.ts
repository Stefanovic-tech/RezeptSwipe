import { z } from "zod";
import { handle, jsonOk, getClientIp } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { redeemInviteForExistingUser } from "@/lib/households";
import { rateLimitInvite } from "@/lib/auth-actions";

const schema = z.object({ code: z.string().min(4) });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    await rateLimitInvite(getClientIp());
    const body = schema.parse(await req.json());
    const result = await redeemInviteForExistingUser(user.id, body.code);
    return jsonOk(result);
  });
}
