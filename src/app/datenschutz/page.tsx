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
        Uebersetzungen externer Rezepte erfolgen standardmaessig ueber ein lokal
        betriebenes Sprachmodell (Ollama) auf dem App-Server; dabei verlassen die
        Rezeptdaten den Server nicht. Optional kann als Fallback Google Gemini
        konfiguriert werden — in diesem Fall werden Rezepttexte zur Uebersetzung
        an Google uebermittelt. Sentry wird, sofern aktiv, fuer Fehler-Telemetrie
        eingesetzt. Es werden nur die fuer die jeweilige Funktion benoetigten
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
