import { handle, jsonOk } from "@/lib/http";
import { requireAdminForApi } from "@/lib/session";
import { listHouseholdsForAdminFull } from "@/lib/admin-households";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdminForApi();
    const url = new URL(req.url);
    const search = url.searchParams.get("search") ?? "";
    const items = await listHouseholdsForAdminFull(search);
    return jsonOk({ items });
  });
}
