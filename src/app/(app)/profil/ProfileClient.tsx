"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SessionItem {
  id: number;
  deviceLabel: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  isCurrent: boolean;
}

export default function ProfileClient({
  user,
  sessions,
}: {
  user: { id: number; username: string; isAdmin: boolean };
  sessions: SessionItem[];
}) {
  const router = useRouter();
  const [username, setUsername] = useState(user.username);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function changeUsername() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/profile/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Konnte nicht aendern.");
        return;
      }
      setInfo("Benutzername aktualisiert.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    setBusy(true);
    setError(null);
    setInfo(null);
    if (newPassword !== confirmPassword) {
      setBusy(false);
      setError("Passwoerter stimmen nicht ueberein.");
      return;
    }
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Konnte Passwort nicht aendern.");
        return;
      }
      setInfo("Passwort aktualisiert. Bitte erneut anmelden.");
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1200);
    } finally {
      setBusy(false);
    }
  }

  async function regenerateRecoveryCodes() {
    if (!confirm("Wirklich neue Recovery-Codes generieren? Alte werden ungueltig.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile/recovery", { method: "POST" });
      const data = await res.json();
      if (data.ok) setRecoveryCodes(data.data.codes);
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(id: number) {
    await fetch(`/api/profile/sessions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {info && <div className="card p-3 text-sm">{info}</div>}
      {error && <div className="card p-3 text-sm text-rose-600">{error}</div>}

      <div className="card p-4 space-y-2">
        <h2 className="font-semibold">Benutzername</h2>
        <div className="flex gap-2">
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button
            className="btn btn-primary"
            onClick={changeUsername}
            disabled={busy || username === user.username}
          >
            Speichern
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="font-semibold">Passwort aendern</h2>
        <input
          className="input"
          type="password"
          placeholder="Aktuelles Passwort"
          autoComplete="current-password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Neues Passwort"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Neues Passwort bestaetigen"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={changePassword}
          disabled={busy}
        >
          Passwort aktualisieren
        </button>
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="font-semibold">Recovery-Codes</h2>
        <p className="text-sm text-neutral-500">
          Zum Zuruecksetzen ohne Admin: Codes neu generieren, alte werden ungueltig.
        </p>
        <button
          className="btn btn-secondary"
          onClick={regenerateRecoveryCodes}
          disabled={busy}
        >
          Neu generieren
        </button>
        {recoveryCodes && (
          <div className="rounded-md bg-brand-50 dark:bg-brand-900/30 p-3 text-sm">
            <p className="mb-2 font-medium">Sicher aufbewahren:</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Aktive Sessions</h2>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {sessions.map((s) => (
            <li key={s.id} className="py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0 text-sm">
                <div className="truncate">
                  {s.userAgent ?? "Unbekanntes Geraet"}
                </div>
                <div className="text-xs text-neutral-500">
                  {s.ipAddress ?? "?"} - seit{" "}
                  {new Date(s.createdAt).toLocaleString("de-CH")}
                </div>
              </div>
              {s.isCurrent ? (
                <span className="badge">aktuell</span>
              ) : (
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => revokeSession(s.id)}
                >
                  Abmelden
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <button className="btn btn-secondary w-full" onClick={logout}>
        Abmelden
      </button>
    </div>
  );
}
