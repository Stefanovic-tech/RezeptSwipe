import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center gap-3">
      <h1 className="text-2xl font-semibold">Seite nicht gefunden</h1>
      <p className="text-sm text-neutral-500">
        Die angeforderte Seite existiert nicht.
      </p>
      <Link href="/" className="btn btn-primary">
        Zur Startseite
      </Link>
    </main>
  );
}
