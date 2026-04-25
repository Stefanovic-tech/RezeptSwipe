import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { adminResetPassword } from "@/lib/admin";
import { passwordSchema } from "@/lib/auth-actions";

const schema = z.object({ newPassword: passwordSchema });

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = schema.parse(await req.json());
    await adminResetPassword(admin.id, Number(params.id), body.newPassword);
    return jsonOk({ ok: true });
  });
}
