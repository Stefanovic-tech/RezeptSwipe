import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { setUserAdmin } from "@/lib/admin";

const schema = z.object({ isAdmin: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = schema.parse(await req.json());
    await setUserAdmin(admin.id, Number(params.id), body.isAdmin);
    return jsonOk({ ok: true });
  });
}
