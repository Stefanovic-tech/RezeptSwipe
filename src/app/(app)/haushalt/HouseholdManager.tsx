"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  userId: number;
  username: string;
  role: "owner" | "member";
  joinedAt: string;
}

interface Invite {
  id: number;
  codePreview: string | null;
  createdAt: string;
  usedCount: number;
  maxUses: number;
  revokedAt: string | null;
  expiresAt: string | null;
  createdByUsername: string | null;
}

interface Prefs {
  vegetarian: boolean;
  vegan: boolean;
  no_pork: boolean;
}

export default function HouseholdManager({
  household,
  myUserId,
  myRole,
  members,
  invites,
  prefs,
}: {
  household: { id: number; name: string };
  myUserId: number;
  myRole: "owner" | "member";
  members: Member[];
  invites: Invite[];
  prefs: Prefs;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [name, setName] = useState(household.name);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");
  const [filterPrefs, setFilterPrefs] = useState<Prefs>(prefs);

  async function createInvite() {
    setBusy(true);
    setError(null);
    setCreatedCode(null);
    try {
      const res = await fetch("/api/household/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maxUses,
          expiresInDays: expiresInDays === "" ? null : Number(expiresInDays),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Konnte Code nicht erstellen.");
        return;
      }
      setCreatedCode(data.data.code);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(id: number) {
    if (!confirm("Invite-Code wirklich widerrufen?")) return;
    await fetch(`/api/household/invites/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function transferOwnership(targetId: number) {
    if (!confirm("Owner-Rolle uebertragen?")) return;
    await fetch("/api/household/transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newOwnerUserId: targetId }),
    });
    router.refresh();
  }

  async function leave() {
    if (!confirm("Haushalt wirklich verlassen?")) return;
    await fetch("/api/household/leave", { method: "POST" });
    router.refresh();
  }

  async function rename() {
    setBusy(true);
    try {
      await fetch("/api/household/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function savePrefs() {
    await fetch("/api/household/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(filterPrefs),
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Aktueller Haushalt</p>
            <p className="text-lg font-semibold">{household.name}</p>
          </div>
          <span className="badge">{myRole}</span>
        </div>
        {myRole === "owner" && (
          <div className="flex gap-2">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn btn-secondary" onClick={rename} disabled={busy}>
              Speichern
            </button>
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Mitglieder</h2>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {members.map((m) => (
            <li key={m.userId} className="py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.username}</div>
                <div className="text-xs text-neutral-500">
                  Mitglied seit {new Date(m.joinedAt).toLocaleDateString("de-CH")}
                </div>
              </div>
              <span className="badge">{m.role}</span>
              {myRole === "owner" && m.userId !== myUserId && m.role !== "owner" && (
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => transferOwnership(m.userId)}
                >
                  Owner machen
                </button>
              )}
            </li>
          ))}
        </ul>
        <button className="btn btn-secondary" onClick={leave}>
          Haushalt verlassen
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Praeferenzen</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          {(["vegetarian", "vegan", "no_pork"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filterPrefs[key]}
                onChange={(e) =>
                  setFilterPrefs((p) => ({ ...p, [key]: e.target.checked }))
                }
              />
              {key === "vegetarian"
                ? "Vegetarisch"
                : key === "vegan"
                ? "Vegan"
                : "Ohne Schwein"}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" onClick={savePrefs}>
          Praeferenzen speichern
        </button>
      </div>

      {myRole === "owner" && (
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">Invite-Codes</h2>
          <div className="grid grid-cols-2 gap-2 items-end">
            <label className="block">
              <span className="text-sm">Max. Nutzungen</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                className="input mt-1"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="text-sm">Gueltig (Tage)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="input mt-1"
                value={expiresInDays}
                onChange={(e) =>
                  setExpiresInDays(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
              />
            </label>
          </div>
          <button
            className="btn btn-primary w-full"
            onClick={createInvite}
            disabled={busy}
          >
            Neuen Code erstellen
          </button>
          {createdCode && (
            <div className="rounded-md bg-brand-50 dark:bg-brand-900/30 p-3 text-sm">
              Neuer Code: <span className="font-mono">{createdCode}</span>
              <p className="text-xs text-neutral-500 mt-1">
                Wird nur jetzt einmal angezeigt.
              </p>
            </div>
          )}
          {error && <div className="text-sm text-rose-600">{error}</div>}

          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {invites.map((i) => (
              <li key={i.id} className="py-2 text-sm flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-mono">{i.codePreview ?? "..."}</div>
                  <div className="text-xs text-neutral-500">
                    {i.usedCount}/{i.maxUses} genutzt
                    {i.expiresAt
                      ? ` - laeuft am ${new Date(i.expiresAt).toLocaleDateString("de-CH")}`
                      : ""}
                    {i.revokedAt ? " - widerrufen" : ""}
                  </div>
                </div>
                {!i.revokedAt && (
                  <button
                    className="btn btn-secondary text-xs"
                    onClick={() => revokeInvite(i.id)}
                  >
                    Widerrufen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
