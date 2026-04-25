"use client";

import { useState } from "react";

export default function LoginForm({ next }: { next?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      // Voller Seitenwechsel: Set-Cookie vom Login-Response ist im naechsten Request garantiert
      // (router.push + router.refresh kann RSC vor Cookie-Jar ausloesen).
      window.location.assign(next ?? "/swipe");
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="block">
        <span className="text-sm font-medium">Benutzername</span>
        <input
          className="input mt-1"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Passwort</span>
        <input
          className="input mt-1"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <div className="text-sm text-rose-600" role="alert">
          {error}
        </div>
      )}
      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? "Anmelden..." : "Anmelden"}
      </button>
    </form>
  );
}
