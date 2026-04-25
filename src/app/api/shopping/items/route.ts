import { z } from "zod";
import { handle, jsonOk } from "@/lib/http";
import { requireUserForApi } from "@/lib/session";
import { addItem } from "@/lib/shopping";

const schema = z.object({
  name: z.string().min(1).max(120),
  amount: z.union([z.number(), z.null()]).optional(),
  unit: z.union([z.string().max(20), z.null()]).optional(),
  recipeId: z.union([z.number().int().positive(), z.null()]).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) return jsonOk({ ok: false });
    const body = schema.parse(await req.json());
    const item = await addItem(user.id, user.currentHouseholdId, {
      name: body.name,
      amount: body.amount ?? null,
      unit: body.unit ?? null,
      recipeId: body.recipeId ?? null,
    });
    return jsonOk({ item });
  });
}
