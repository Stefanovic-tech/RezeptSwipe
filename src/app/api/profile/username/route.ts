import { handle, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { changeUsername, usernameSchema } from "@/lib/auth-actions";
import { z } from "zod";

const schema = z.object({ username: usernameSchema });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const result = await changeUsername(user.id, body.username);
    return jsonOk(result);
  });
}
