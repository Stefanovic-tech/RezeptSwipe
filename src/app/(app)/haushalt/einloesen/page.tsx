import { requireUser } from "@/lib/session";
import RedeemForm from "./RedeemForm";

export const dynamic = "force-dynamic";

export default async function RedeemPage() {
  await requireUser();
  return (
    <section className="py-2 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-2">Invite-Code einloesen</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Trete einem weiteren Haushalt bei oder werde erneut Mitglied.
      </p>
      <RedeemForm />
    </section>
  );
}
