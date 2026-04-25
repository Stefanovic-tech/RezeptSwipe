import { handle, jsonOk } from "@/lib/http";
import { ApiError, requireUser } from "@/lib/session";
import {
  customRecipeInputSchema,
  deleteCustomRecipe,
  getCustomRecipe,
  updateCustomRecipe,
} from "@/lib/custom-recipes";

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Ungueltige Rezept-ID.");
  }
  return id;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    if (!user.currentHouseholdId) throw new ApiError(400, "Kein Haushalt ausgewaehlt.");
    const recipe = await getCustomRecipe(user.id, user.currentHouseholdId, parseId(params.id));
    return jsonOk(recipe);
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    if (!user.currentHouseholdId) throw new ApiError(400, "Kein Haushalt ausgewaehlt.");
    const input = customRecipeInputSchema.parse(await req.json());
    await updateCustomRecipe(user.id, user.currentHouseholdId, parseId(params.id), input);
    return jsonOk({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    if (!user.currentHouseholdId) throw new ApiError(400, "Kein Haushalt ausgewaehlt.");
    await deleteCustomRecipe(user.id, user.currentHouseholdId, parseId(params.id));
    return jsonOk({ ok: true });
  });
}
