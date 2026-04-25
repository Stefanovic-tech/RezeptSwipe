import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUser, clearAuthCookies } from "@/lib/session";
import { changePassword, passwordSchema } from "@/lib/auth-actions";

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    await changePassword(user.id, body.oldPassword, body.newPassword);
    clearAuthCookies();
    return jsonOk({ ok: true });
  });
}
