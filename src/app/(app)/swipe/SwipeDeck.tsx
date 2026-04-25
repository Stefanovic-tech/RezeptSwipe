"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SwipeEmptyHint } from "./empty-hint";

interface RecipeItem {
  id: number;
  title: string;
  imageUrl: string | null;
  category: string | null;
  area: string | null;
  effort: "quick" | "normal" | "elaborate";
  estMinutes: number | null;
  isVegetarian: boolean;
  isVegan: boolean;
  hasPork: boolean;
}

interface Prefs {
  vegetarian: boolean;
  vegan: boolean;
  no_pork: boolean;
}

const effortLabels = {
  quick: "schnell",
  normal: "normal",
  elaborate: "aufwendig",
} as const;

function effortLabel(e: RecipeItem["effort"]): string {
  return effortLabels[e];
}

export default function SwipeDeck({
  initialDeck,
  initialPrefs,
  emptyHint = null,
}: {
  initialDeck: RecipeItem[];
  initialPrefs: Prefs;
  emptyHint?: SwipeEmptyHint;
}) {
  const [deck, setDeck] = useState<RecipeItem[]>(initialDeck);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [busy, setBusy] = useState(false);
  const [lastUndoableId, setLastUndoableId] = useState<number | null>(null);
  const [lastUndoableStatus, setLastUndoableStatus] = useState<"liked" | "passed" | null>(null);
  const [undoTimer, setUndoTimer] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragState = useRef<{ startX: number; startY: number; deltaX: number } | null>(null);
  const [transform, setTransform] = useState<string>("translate3d(0,0,0)");

  const top = deck[0];

  const reload = useCallback(async (next: Prefs) => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        vegetarian: next.vegetarian ? "1" : "0",
        vegan: next.vegan ? "1" : "0",
        noPork: next.no_pork ? "1" : "0",
      });
      const res = await fetch(`/api/swipe/deck?${params.toString()}`);
      const data = await res.json();
      if (data.ok) setDeck(data.data.deck);
      else setError(data?.error?.message ?? "Konnte Deck nicht laden.");
    } catch {
      setError("Netzwerkfehler beim Laden des Decks.");
    } finally {
      setBusy(false);
    }
  }, []);

  async function decide(status: "liked" | "passed", recipeId: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/swipe/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipeId, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Konnte Entscheidung nicht speichern.");
        return;
      }
      setDeck((prev) => prev.slice(1));
      setLastUndoableId(recipeId);
      setLastUndoableStatus(status);
      setUndoTimer(5);
      if (undoTimeoutRef.current) clearInterval(undoTimeoutRef.current);
      undoTimeoutRef.current = setInterval(() => {
        setUndoTimer((t) => {
          if (t <= 1) {
            if (undoTimeoutRef.current) clearInterval(undoTimeoutRef.current);
            setLastUndoableId(null);
            setLastUndoableStatus(null);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } catch {
      setError("Netzwerkfehler beim Speichern.");
    } finally {
      setBusy(false);
      setTransform("translate3d(0,0,0)");
    }
  }

  async function undo() {
    if (lastUndoableId === null) return;
    try {
      const res = await fetch("/api/swipe/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipeId: lastUndoableId }),
      });
      const data = await res.json();
      if (data.ok) {
        // Karte zurueck an Position 0 anhand neuer Deck-Anfrage
        await reload(prefs);
      }
    } finally {
      setLastUndoableId(null);
      setLastUndoableStatus(null);
      setUndoTimer(0);
      if (undoTimeoutRef.current) clearInterval(undoTimeoutRef.current);
    }
  }

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearInterval(undoTimeoutRef.current);
    };
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!top || busy) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, deltaX: 0 };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    dragState.current.deltaX = dx;
    const rotate = Math.max(-12, Math.min(12, dx / 12));
    setTransform(`translate3d(${dx}px, 0, 0) rotate(${rotate}deg)`);
  }

  function onPointerUp() {
    const ds = dragState.current;
    dragState.current = null;
    if (!ds || !top) {
      setTransform("translate3d(0,0,0)");
      return;
    }
    const dx = ds.deltaX;
    const threshold = 80;
    if (dx > threshold) {
      setTransform("translate3d(110vw, 0, 0) rotate(15deg)");
      void decide("liked", top.id);
    } else if (dx < -threshold) {
      setTransform("translate3d(-110vw, 0, 0) rotate(-15deg)");
      void decide("passed", top.id);
    } else {
      setTransform("translate3d(0,0,0)");
    }
  }

  async function applyPrefs(next: Prefs) {
    setPrefs(next);
    await fetch("/api/household/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    await reload(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <PrefBadge
          label="Vegetarisch"
          active={prefs.vegetarian}
          onToggle={() => applyPrefs({ ...prefs, vegetarian: !prefs.vegetarian })}
        />
        <PrefBadge
          label="Vegan"
          active={prefs.vegan}
          onToggle={() =>
            applyPrefs({
              ...prefs,
              vegan: !prefs.vegan,
              vegetarian: prefs.vegan ? prefs.vegetarian : true,
            })
          }
        />
        <PrefBadge
          label="Ohne Schwein"
          active={prefs.no_pork}
          onToggle={() => applyPrefs({ ...prefs, no_pork: !prefs.no_pork })}
        />
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}

      <div className="relative h-[60dvh] min-h-[420px] mt-2">
        {deck.length === 0 ? (
          <EmptyDeck
            hint={emptyHint}
            onRelax={() => applyPrefs({ vegetarian: false, vegan: false, no_pork: false })}
            onResetSwipe={async () => {
              setBusy(true);
              setError(null);
              try {
                const res = await fetch("/api/swipe/reset", { method: "POST" });
                const data = await res.json();
                if (!res.ok || !data.ok) {
                  setError(data?.error?.message ?? "Zuruecksetzen fehlgeschlagen.");
                  return;
                }
                await reload(prefs);
              } catch {
                setError("Netzwerkfehler beim Zuruecksetzen.");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          deck.slice(0, 3).map((r, idx) => {
            const isTop = idx === 0;
            return (
              <div
                key={r.id}
                className="swipe-card absolute inset-0 card overflow-hidden"
                style={{
                  transform: isTop ? transform : `translate3d(0, ${idx * 6}px, 0) scale(${1 - idx * 0.03})`,
                  transition: isTop && !dragState.current ? "transform 250ms ease" : undefined,
                  zIndex: 100 - idx,
                  pointerEvents: isTop ? "auto" : "none",
                }}
                onPointerDown={isTop ? onPointerDown : undefined}
                onPointerMove={isTop ? onPointerMove : undefined}
                onPointerUp={isTop ? onPointerUp : undefined}
                onPointerCancel={isTop ? onPointerUp : undefined}
              >
                <div className="relative aspect-[4/3] bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  {r.imageUrl ? (
                    <>
                      <Image
                        src={r.imageUrl}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 600px"
                        style={{ objectFit: "cover" }}
                        unoptimized
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-16 pb-3 px-4 pointer-events-none">
                        <p className="text-white font-semibold text-lg leading-snug drop-shadow-md">
                          {r.title}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
                      <span className="text-5xl mb-2 opacity-90" aria-hidden>
                        🍽️
                      </span>
                      <p className="text-white font-semibold text-xl leading-tight">{r.title}</p>
                      {(r.category || r.area) && (
                        <p className="text-white/85 text-sm mt-2">
                          {[r.category, r.area].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  {r.imageUrl ? (
                    <h2 className="sr-only">{r.title}</h2>
                  ) : (
                    <h2 className="text-lg font-semibold leading-tight">{r.title}</h2>
                  )}
                  <div
                    className={`flex flex-wrap gap-2 text-xs text-neutral-600 dark:text-neutral-400 ${
                      r.imageUrl ? "mt-0" : "mt-2"
                    }`}
                  >
                    {r.area && <span className="badge">{r.area}</span>}
                    {r.category && <span className="badge">{r.category}</span>}
                    <span className="badge">{effortLabel(r.effort)}</span>
                    {r.estMinutes && <span className="badge">{r.estMinutes} min</span>}
                    {r.isVegan ? (
                      <span className="badge">vegan</span>
                    ) : r.isVegetarian ? (
                      <span className="badge">vegetarisch</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-2">
        <button
          type="button"
          onClick={() => top && decide("passed", top.id)}
          disabled={!top || busy}
          className="btn btn-secondary flex-1"
          aria-label="Ablehnen"
        >
          Nein
        </button>
        <button
          type="button"
          onClick={() => undo()}
          disabled={lastUndoableId === null}
          className="btn btn-secondary text-sm"
        >
          Rueckgaengig {undoTimer > 0 ? `(${undoTimer}s)` : ""}
        </button>
        <button
          type="button"
          onClick={() => top && decide("liked", top.id)}
          disabled={!top || busy}
          className="btn btn-primary flex-1"
          aria-label="Gefaellt mir"
        >
          Ja
        </button>
      </div>
      {deck.length < 3 && (
        <button
          type="button"
          className="btn btn-secondary text-sm"
          onClick={() => reload(prefs)}
        >
          Mehr laden
        </button>
      )}
      {lastUndoableStatus && (
        <p className="text-xs text-neutral-500">
          Letzte Aktion: {lastUndoableStatus === "liked" ? "Gemerkt" : "Verworfen"}.
        </p>
      )}
    </div>
  );
}

function PrefBadge({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-2 rounded-full text-sm border transition ${
        active
          ? "bg-brand-500 text-white border-brand-500"
          : "bg-transparent border-neutral-300 dark:border-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyDeck({
  hint,
  onRelax,
  onResetSwipe,
}: {
  hint: SwipeEmptyHint;
  onRelax: () => void;
  onResetSwipe: () => void | Promise<void>;
}) {
  if (hint === "no_seed") {
    return (
      <div className="absolute inset-0 card flex flex-col items-center justify-center text-center p-6 gap-3">
        <p className="text-lg font-medium">Noch keine Standardrezepte in der Datenbank</p>
        <p className="text-sm text-neutral-500">
          Migrationen legen nur Tabellen an. Bitte einmal im Projektordner ausfuehren:
        </p>
        <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
          npm run seed
        </code>
        <p className="text-xs text-neutral-500">
          Danach Seite neu laden. Unter Windows reicht auch <code>start.bat</code> (fuellt
          Rezepte nach dem Migrieren automatisch auf).
        </p>
      </div>
    );
  }

  if (hint === "all_swiped") {
    return (
      <div className="absolute inset-0 card flex flex-col items-center justify-center text-center p-6 gap-3">
        <p className="text-lg font-medium">Alle Vorschlaege bewertet</p>
        <p className="text-sm text-neutral-500">
          Du hast alle globalen Rezepte fuer diesen Haushalt schon mit Ja oder Nein
          bewertet. Eigene Haushaltsrezepte bleiben davon unberuehrt.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => void onResetSwipe()}>
          Swipe fuer Standardrezepte zuruecksetzen
        </button>
        <button type="button" className="btn btn-secondary text-sm" onClick={onRelax}>
          Filter lockern
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 card flex flex-col items-center justify-center text-center p-6 gap-3">
      <p className="text-lg font-medium">Keine passenden Karten</p>
      <p className="text-sm text-neutral-500">
        {hint === "filters"
          ? "Mit den aktuellen Filtern gibt es nichts Neues. Filter lockern oder spaeter wieder vorbeischauen."
          : "Filter lockern oder spaeter wieder vorbeischauen."}
      </p>
      <button type="button" className="btn btn-primary" onClick={onRelax}>
        Filter lockern
      </button>
    </div>
  );
}
