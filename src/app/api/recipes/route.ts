import { handle, jsonOk } from "@/lib/http";
import { ApiError, requireUserForApi } from "@/lib/session";
import {
  createCustomRecipe,
  customRecipeInputSchema,
  listCustomRecipes,
} from "@/lib/custom-recipes";

export async function GET() {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) {
      throw new ApiError(400, "Kein Haushalt ausgewaehlt.");
    }
    const items = await listCustomRecipes(user.id, user.currentHouseholdId);
    return jsonOk({ items });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUserForApi();
    if (!user.currentHouseholdId) {
      throw new ApiError(400, "Kein Haushalt ausgewaehlt.");
    }
    const input = customRecipeInputSchema.parse(await req.json());
    const created = await createCustomRecipe(user.id, user.currentHouseholdId, input);
    return jsonOk({ id: created.id });
  });
}
