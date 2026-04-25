"use client";

import { useState } from "react";

export default function RegisterForm() {
  const [inviteCode, setInviteCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwoerter stimmen nicht ueberein.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Registrierung fehlgeschlagen.");
        return;
      }
      setRecoveryCodes(data.data.recoveryCodes ?? []);
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  if (recoveryCodes) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Wichtig: Recovery-Codes sichern</h2>
        <p className="text-sm">
          Diese Codes sind dein einziger Weg, dein Passwort selbst
          zurueckzusetzen. Bewahre sie sicher auf. Sie werden{" "}
          <strong>nur jetzt</strong> angezeigt.
        </p>
        <ul className="grid grid-cols-2 gap-2 text-sm font-mono">
          {recoveryCodes.map((c) => (
            <li
              key={c}
              className="rounded-md bg-neutral-100 dark:bg-neutral-800 p-2 text-center"
            >
              {c}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            window.location.assign("/swipe");
          }}
        >
          Verstanden, weiter zu RezeptSwipe
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="block">
        <span className="text-sm font-medium">Invite-Code</span>
        <input
          className="input mt-1 uppercase tracking-widest"
          type="text"
          required
          autoCapitalize="characters"
          autoCorrect="off"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Benutzername</span>
        <input
          className="input mt-1"
          type="text"
          required
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Passwort</span>
        <input
          className="input mt-1"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Passwort bestaetigen</span>
        <input
          className="input mt-1"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {error && (
        <div className="text-sm text-rose-600" role="alert">
          {error}
        </div>
      )}
      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? "Konto wird erstellt..." : "Konto erstellen"}
      </button>
    </form>
  );
}
