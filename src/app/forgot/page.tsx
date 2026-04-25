import Link from "next/link";
import ForgotForm from "./ForgotForm";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <main className="min-h-dvh flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-lg">RezeptSwipe</span>
        <ThemeToggle />
      </header>
      <section className="flex-1 px-4 flex items-center justify-center">
        <div className="card w-full max-w-md p-6">
          <h1 className="text-xl font-semibold mb-1">Passwort zuruecksetzen</h1>
          <p className="text-sm text-neutral-500 mb-4">
            Mit Benutzername und einem Recovery-Code aus der Registrierung.
          </p>
          <ForgotForm />
          <div className="mt-6 text-sm">
            <Link href="/login" className="text-brand-600">
              Zurueck zur Anmeldung
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
