import { z } from "zod";
import { handle, jsonOk, getClientIp, getUserAgent } from "@/lib/http";
import { loginUser, passwordSchema, usernameSchema } from "@/lib/auth-actions";

const schema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export async function POST(req: Request) {
  return handle(async () => {
    const json = await req.json();
    const body = schema.parse(json);
    const user = await loginUser(body.username, body.password, {
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return jsonOk({ user });
  });
}
