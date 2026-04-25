"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface Session {
  id: number;
  effort: "quick" | "normal" | "elaborate" | "any";
  maxMinutes: number | null;
  status: "active" | "finished" | "cancelled";
}

interface RecipeDetail {
  id: number;
  title: string;
  imageUrl: string | null;
  category: string | null;
  area: string | null;
  effort: "quick" | "normal" | "elaborate";
  estMinutes: number | null;
  ingredients: { name: string; amount: number | null; unit: string | null }[];
  steps: string[];
}

const POLL_MS = 10_000;

export default function CookingClient({
  initialSession,
  likedCount,
}: {
  initialSession: Session | null;
  likedCount: number;
}) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [candidate, setCandidate] = useState<RecipeDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effort, setEffort] = useState<Session["effort"]>("any");
  const [maxMinutes, setMaxMinutes] = useState<string>("");
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  async function fetchCandidate(activeSession: Session) {
    if (activeSession.status !== "active") return;
    try {
      const res = await fetch(`/api/cook/next?sessionId=${activeSession.id}`);
      const data = await res.json();
      if (data.ok) setCandidate(data.data.recipe ?? null);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (session && session.status === "active" && !candidate) {
      void fetchCandidate(session);
    }
  }, [session, candidate]);

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/cook/active");
        const data = await res.json();
        if (data.ok) {
          if (!data.data.session) setSession(null);
          else if (data.data.session.status !== "active") {
            setSession(data.data.session);
          }
        }
      } catch {
        // ignore
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [session]);

  async function startSession() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cook/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          effort,
          maxMinutes: maxMinutes ? Number(maxMinutes) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Konnte Session nicht starten.");
        return;
      }
      setSession(data.data.session);
      setCandidate(null);
      void fetchCandidate(data.data.session);
    } finally {
      setBusy(false);
    }
  }

  async function decide(accepted: boolean) {
    if (!session || !candidate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cook/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          recipeId: candidate.id,
          accepted,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Konnte nicht entscheiden.");
        return;
      }
      const updated: Session = data.data.session;
      setSession(updated);
      setCandidate(null);
      if (updated.status !== "active") {
        setDoneMessage(
          accepted
            ? "Super! Zutaten wurden zur Einkaufsliste hinzugefuegt."
            : "Session beendet."
        );
      } else {
        await fetchCandidate(updated);
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!session) return;
    setBusy(true);
    try {
      await fetch("/api/cook/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      setSession(null);
      setCandidate(null);
      setDoneMessage(null);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="space-y-4">
        {doneMessage && (
          <div className="card p-3 text-sm">{doneMessage}</div>
        )}
        <div className="card p-4 space-y-3">
          <p className="text-sm">
            Du hast aktuell <strong>{likedCount}</strong> gemerkte Rezepte.
          </p>
          <label className="block">
            <span className="text-sm font-medium">Aufwand</span>
            <select
              className="input mt-1"
              value={effort}
              onChange={(e) =>
                setEffort(e.target.value as Session["effort"])
              }
            >
              <option value="any">Egal</option>
              <option value="quick">Schnell</option>
              <option value="normal">Normal</option>
              <option value="elaborate">Aufwendig</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Max. Minuten (optional)</span>
            <input
              className="input mt-1"
              type="number"
              inputMode="numeric"
              min={5}
              step={5}
              value={maxMinutes}
              onChange={(e) => setMaxMinutes(e.target.value)}
            />
          </label>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <button
            className="btn btn-primary w-full"
            onClick={startSession}
            disabled={busy || likedCount === 0}
          >
            Session starten
          </button>
          {likedCount === 0 && (
            <p className="text-xs text-neutral-500">
              Bitte erst Rezepte im Swipe-Bereich merken.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (session.status !== "active") {
    return (
      <div className="space-y-3">
        <div className="card p-3 text-sm">
          Session abgeschlossen. {doneMessage ?? ""}
        </div>
        <button className="btn btn-secondary" onClick={() => setSession(null)}>
          Neue Session
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        {candidate ? (
          <>
            <div className="relative aspect-[4/3] bg-neutral-200 dark:bg-neutral-800">
              {candidate.imageUrl ? (
                <Image
                  src={candidate.imageUrl}
                  alt={candidate.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  style={{ objectFit: "cover" }}
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-4xl">
                  🍳
                </div>
              )}
            </div>
            <div className="p-4 space-y-3">
              <h2 className="text-lg font-semibold">{candidate.title}</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {candidate.area && <span className="badge">{candidate.area}</span>}
                {candidate.category && <span className="badge">{candidate.category}</span>}
                {candidate.estMinutes && <span className="badge">{candidate.estMinutes} min</span>}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer">Zutaten</summary>
                <ul className="mt-2 list-disc list-inside">
                  {candidate.ingredients.map((ing, i) => (
                    <li key={i}>
                      {ing.amount ?? ""} {ing.unit ?? ""} {ing.name}
                    </li>
                  ))}
                </ul>
              </details>
              <details className="text-sm">
                <summary className="cursor-pointer">Schritte</summary>
                <ol className="mt-2 list-decimal list-inside space-y-1">
                  {candidate.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </details>
            </div>
          </>
        ) : (
          <div className="p-6 text-center text-sm text-neutral-500">
            Keine passenden gemerkten Rezepte zu diesen Vorgaben.
          </div>
        )}
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}

      <div className="flex gap-2">
        <button
          className="btn btn-secondary flex-1"
          onClick={() => decide(false)}
          disabled={busy || !candidate}
        >
          Anderes
        </button>
        <button
          className="btn btn-primary flex-1"
          onClick={() => decide(true)}
          disabled={busy || !candidate}
        >
          Heute kochen
        </button>
      </div>
      <button className="btn btn-secondary text-sm" onClick={cancel} disabled={busy}>
        Session abbrechen
      </button>
    </div>
  );
}
