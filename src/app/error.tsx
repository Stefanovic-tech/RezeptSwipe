"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center gap-3">
      <h1 className="text-2xl font-semibold">Ein Fehler ist aufgetreten</h1>
      <p className="text-sm text-neutral-500 max-w-md">
        {error.message || "Bitte versuche es erneut."}
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Erneut versuchen
      </button>
    </main>
  );
}
