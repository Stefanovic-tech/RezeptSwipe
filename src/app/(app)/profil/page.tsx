import { requireUser, listSessionsForUser } from "@/lib/session";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const sessions = await listSessionsForUser(user.id);
  return (
    <section className="py-2 space-y-4">
      <h1 className="text-xl font-semibold">Profil</h1>
      <ProfileClient
        user={{ id: user.id, username: user.username, isAdmin: user.isAdmin }}
        sessions={sessions}
      />
    </section>
  );
}
