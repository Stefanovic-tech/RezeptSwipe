import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi } from "@/lib/session";
import { setUserBanned } from "@/lib/admin";

const schema = z.object({ banned: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const admin = await requireAdminForApi();
    const body = schema.parse(await req.json());
    await setUserBanned(admin.id, Number(params.id), body.banned);
    return jsonOk({ ok: true });
  });
}
