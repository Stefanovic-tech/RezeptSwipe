import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { listUserHouseholds } from "@/lib/auth-actions";
import { getHousehold } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const households = await listUserHouseholds(user.id);
  const currentHousehold =
    user.currentHouseholdId ? await getHousehold(user.currentHouseholdId) : null;

  if (households.length === 0) {
    return (
      <main className="min-h-dvh px-4 py-6 flex flex-col items-center justify-center text-center gap-4">
        <h1 className="text-xl font-semibold">Kein Haushalt</h1>
        <p className="text-sm text-neutral-500 max-w-md">
          Du bist aktuell in keinem Haushalt. Bitte einen Invite-Code einloesen.
        </p>
        <Link href="/haushalt/einloesen" className="btn btn-primary">
          Invite-Code einloesen
        </Link>
        <form action="/api/auth/logout" method="post" className="mt-2">
          <button type="submit" className="btn btn-secondary">
            Abmelden
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        user={user}
        currentHousehold={currentHousehold}
        households={households.map((h) => ({
          id: h.id,
          name: h.name,
          role: h.role,
        }))}
      />
      <main className="flex-1 pb-20 pt-2 px-4 max-w-3xl mx-auto w-full">
        {children}
      </main>
      <BottomNav isAdmin={user.isAdmin} />
    </div>
  );
}
