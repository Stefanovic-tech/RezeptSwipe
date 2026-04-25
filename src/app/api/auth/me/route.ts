import { handle, jsonOk } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    return jsonOk({ user });
  });
}
