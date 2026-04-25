export const metadata = { title: "Impressum | RezeptSwipe" };

export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Impressum</h1>
      <p className="mb-4">Angaben gemaess gesetzlicher Anforderungen.</p>
      <p className="mb-2 font-medium">Verantwortlich:</p>
      <p>Stefan Krinulovic</p>
      <p>Kontakt: rezept@krinulovic.ch</p>
      <p className="mt-6 text-sm text-neutral-500">
        Diese Seite ist eine Vorlage. Bitte vor dem Live-Gang vervollstaendigen.
      </p>
    </main>
  );
}
