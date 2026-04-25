import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { listItems } from "@/lib/shopping";
import ShoppingClient from "./ShoppingClient";

export const dynamic = "force-dynamic";

export default async function ShoppingPage() {
  const user = await requireUser();
  if (!user.currentHouseholdId) redirect("/haushalt/einloesen");
  const initial = await listItems(user.id, user.currentHouseholdId);
  return (
    <section className="py-2">
      <h1 className="text-xl font-semibold mb-2">Einkaufsliste</h1>
      <ShoppingClient initialList={initial.list} initialItems={initial.items} />
    </section>
  );
}
