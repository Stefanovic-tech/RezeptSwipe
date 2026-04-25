"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Item {
  id: number;
  name: string;
  amount: number | null;
  unit: string | null;
  recipeId: number | null;
  recipeTitle: string | null;
  checked: boolean;
}

interface ShoppingList {
  id: number;
  status: "open" | "done";
}

const POLL_MS = 5_000;
const MAX_BACKOFF = 60_000;

export default function ShoppingClient({
  initialList,
  initialItems,
}: {
  initialList: ShoppingList;
  initialItems: Item[];
}) {
  const [list, setList] = useState<ShoppingList>(initialList);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [view, setView] = useState<"aggregate" | "byRecipe">("aggregate");
  const [hideChecked, setHideChecked] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const backoffRef = useRef<number>(POLL_MS);

  async function refresh() {
    try {
      const res = await fetch("/api/shopping/list");
      const data = await res.json();
      if (data.ok) {
        setList(data.data.list);
        setItems(data.data.items);
        backoffRef.current = POLL_MS;
      }
    } catch {
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      if (cancelled) return;
      await refresh();
      if (cancelled) return;
      timeout = setTimeout(tick, backoffRef.current);
    }
    timeout = setTimeout(tick, backoffRef.current);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shopping/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount: amount ? Number(amount) : null,
          unit: unit.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Konnte nicht hinzufuegen.");
        return;
      }
      setItems((prev) => [...prev, data.data.item]);
      setName("");
      setAmount("");
      setUnit("");
    } finally {
      setBusy(false);
    }
  }

  async function toggleChecked(item: Item) {
    setPending((p) => new Set(p).add(item.id));
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
    );
    try {
      await fetch(`/api/shopping/items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checked: !item.checked }),
      });
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function deleteItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/shopping/items/${id}`, { method: "DELETE" });
  }

  async function finishList() {
    if (!confirm("Liste abschliessen und neue starten?")) return;
    await fetch("/api/shopping/finish", { method: "POST" });
    await refresh();
  }

  const visible = useMemo(() => {
    return hideChecked ? items.filter((i) => !i.checked) : items;
  }, [items, hideChecked]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of visible) {
      const key = it.recipeTitle ?? "Frei hinzugefuegt";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [visible]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`btn text-sm ${view === "aggregate" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setView("aggregate")}
        >
          Zusammengefasst
        </button>
        <button
          type="button"
          className={`btn text-sm ${view === "byRecipe" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setView("byRecipe")}
        >
          Nach Rezept
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideChecked}
            onChange={(e) => setHideChecked(e.target.checked)}
          />
          erledigte ausblenden
        </label>
      </div>

      <form onSubmit={addItem} className="card p-3 grid grid-cols-12 gap-2">
        <input
          className="input col-span-12"
          placeholder="Eintrag hinzufuegen"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input col-span-4"
          placeholder="Menge"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="input col-span-4"
          placeholder="Einheit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <button className="btn btn-primary col-span-4" disabled={busy} type="submit">
          Hinzufuegen
        </button>
      </form>

      {error && <div className="text-sm text-rose-600">{error}</div>}

      {visible.length === 0 ? (
        <div className="card p-4 text-sm text-neutral-500">
          Keine offenen Eintraege.
        </div>
      ) : view === "aggregate" ? (
        <ul className="card divide-y divide-neutral-200 dark:divide-neutral-800">
          {visible.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              onToggle={() => toggleChecked(it)}
              onDelete={() => deleteItem(it.id)}
              busy={pending.has(it.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          {grouped.map(([title, list]) => (
            <div key={title} className="card overflow-hidden">
              <div className="px-3 py-2 text-sm font-medium bg-neutral-100 dark:bg-neutral-800">
                {title}
              </div>
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {list.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    onToggle={() => toggleChecked(it)}
                    onDelete={() => deleteItem(it.id)}
                    busy={pending.has(it.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-secondary w-full" onClick={finishList}>
        Liste abschliessen
      </button>
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
  busy,
}: {
  item: Item;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <li className="flex items-center gap-2 p-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={`w-7 h-7 rounded-md border flex items-center justify-center text-sm ${
          item.checked
            ? "bg-brand-500 border-brand-500 text-white"
            : "border-neutral-300 dark:border-neutral-700"
        }`}
        aria-label={item.checked ? "Erledigt entfernen" : "Erledigen"}
      >
        {item.checked ? "x" : ""}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${item.checked ? "line-through text-neutral-500" : ""}`}>
          {item.amount ?? ""} {item.unit ?? ""} {item.name}
        </div>
        {item.recipeTitle && (
          <div className="text-xs text-neutral-500 truncate">{item.recipeTitle}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="text-xs text-neutral-500 hover:text-rose-600 px-2"
      >
        loeschen
      </button>
    </li>
  );
}
