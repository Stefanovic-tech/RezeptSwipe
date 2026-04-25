import { requireAdmin } from "@/lib/session";
import { listUsers, getAuditLog } from "@/lib/admin";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const [users, audit] = await Promise.all([listUsers(), getAuditLog(50)]);
  return (
    <section className="py-2 space-y-4">
      <h1 className="text-xl font-semibold">Admin</h1>
      <AdminClient
        users={users}
        audit={audit.map((a) => ({
          id: a.id,
          actor: a.actor_username,
          action: a.action,
          target: a.target_username,
          targetHouseholdId: a.target_household_id,
          createdAt: a.created_at,
        }))}
      />
    </section>
  );
}
