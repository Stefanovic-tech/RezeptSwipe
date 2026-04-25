import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getHousehold,
  getPreferences,
  listInvites,
  listMembers,
  ensureMembership,
} from "@/lib/households";
import HouseholdManager from "./HouseholdManager";

export const dynamic = "force-dynamic";

export default async function HouseholdPage() {
  const user = await requireUser();
  if (!user.currentHouseholdId) redirect("/haushalt/einloesen");
  const role = await ensureMembership(user.id, user.currentHouseholdId);
  const [household, members, invites, prefs] = await Promise.all([
    getHousehold(user.currentHouseholdId),
    listMembers(user.currentHouseholdId),
    role === "owner" ? listInvites(user.currentHouseholdId) : Promise.resolve([]),
    getPreferences(user.currentHouseholdId),
  ]);
  if (!household) redirect("/haushalt/einloesen");

  return (
    <section className="py-2 space-y-4">
      <h1 className="text-xl font-semibold">Haushalt</h1>
      <HouseholdManager
        household={household}
        myUserId={user.id}
        myRole={role}
        members={members.map((m) => ({
          userId: m.user_id,
          username: m.username,
          role: m.role,
          joinedAt: m.joined_at,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          codePreview: i.code_preview,
          createdAt: i.created_at,
          usedCount: i.used_count,
          maxUses: i.max_uses,
          revokedAt: i.revoked_at,
          expiresAt: i.expires_at,
          createdByUsername: i.created_by_username,
        }))}
        prefs={prefs}
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/haushalt/einloesen" className="btn btn-secondary text-sm">
          Anderen Haushalt beitreten
        </Link>
        <Link href="/profil" className="btn btn-secondary text-sm">
          Profil verwalten
        </Link>
      </div>
    </section>
  );
}
