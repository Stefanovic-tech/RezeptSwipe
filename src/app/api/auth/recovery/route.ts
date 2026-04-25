import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import {
  passwordSchema,
  resetPasswordWithRecoveryCode,
  usernameSchema,
} from "@/lib/auth-actions";

const schema = z.object({
  username: usernameSchema,
  code: z.string().min(4),
  password: passwordSchema,
});

export async function POST(req: Request) {
  return handle(async () => {
    const json = await req.json();
    const body = schema.parse(json);
    await resetPasswordWithRecoveryCode(body.username, body.code, body.password);
    return jsonOk({ ok: true });
  });
}
