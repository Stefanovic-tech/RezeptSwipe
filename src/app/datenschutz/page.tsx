export const metadata = { title: "Datenschutz | RezeptSwipe" };

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-4">
      <h1 className="text-2xl font-semibold">Datenschutz</h1>
      <p>
        RezeptSwipe verarbeitet ausschliesslich Daten, die fuer den Betrieb noetig
        sind: Benutzername, Login-Sessions, Haushalts- und Rezeptaktivitaeten.
      </p>
      <p>
        Es werden keine E-Mail-Adressen erhoben. Passwoerter werden ausschliesslich
        als Hash gespeichert. Wiederherstellung ueber persoenliche Recovery-Codes.
      </p>
      <p>
        Eingesetzte Drittanbieter (sofern aktiv): Google Gemini fuer Uebersetzungen,
        Sentry fuer Fehler-Telemetrie. Es werden nur die fuer die Funktion benoetigten
        Daten uebertragen.
      </p>
      <p>
        Auf Anfrage werden Konten und alle zugehoerigen Daten geloescht.
      </p>
      <p className="text-sm text-neutral-500">
        Diese Seite ist eine Vorlage und sollte vor dem Live-Gang an die finalen
        Anforderungen angepasst werden.
      </p>
    </main>
  );
}
