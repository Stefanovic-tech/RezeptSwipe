import { z } from "zod";
import { handle, jsonOk, getClientIp, getUserAgent } from "@/lib/http";
import {
  passwordSchema,
  registerUserWithInvite,
  usernameSchema,
} from "@/lib/auth-actions";

const schema = z.object({
  inviteCode: z.string().min(4, "Invite-Code zu kurz."),
  username: usernameSchema,
  password: passwordSchema,
});

export async function POST(req: Request) {
  return handle(async () => {
    const json = await req.json();
    const body = schema.parse(json);
    const result = await registerUserWithInvite(
      body.inviteCode,
      body.username,
      body.password,
      { ip: getClientIp(), userAgent: getUserAgent() }
    );
    return jsonOk(result);
  });
}
