import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import RegisterForm from "./RegisterForm";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/swipe");

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-lg">RezeptSwipe</span>
        <ThemeToggle />
      </header>
      <section className="flex-1 px-4 flex items-center justify-center">
        <div className="card w-full max-w-md p-6">
          <h1 className="text-xl font-semibold mb-1">Konto erstellen</h1>
          <p className="text-sm text-neutral-500 mb-4">
            Du brauchst einen Invite-Code aus einem bestehenden Haushalt.
          </p>
          <RegisterForm />
          <div className="mt-6 text-sm">
            <Link href="/login" className="text-brand-600">
              Schon ein Konto? Anmelden
            </Link>
          </div>
        </div>
      </section>
      <footer className="px-4 py-3 text-xs text-center text-neutral-500">
        <Link href="/impressum" className="underline mx-2">
          Impressum
        </Link>
        <Link href="/datenschutz" className="underline mx-2">
          Datenschutz
        </Link>
      </footer>
    </main>
  );
}
