import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { regenerateRecoveryCodes } from "@/lib/auth-actions";

export async function POST() {
  return handle(async () => {
    const user = await requireUserForApi();
    const codes = await regenerateRecoveryCodes(user.id);
    return jsonOk({ codes });
  });
}
