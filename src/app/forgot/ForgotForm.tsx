"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwoerter stimmen nicht ueberein.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, code, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Zuruecksetzen fehlgeschlagen.");
        return;
      }
      setDone(true);
    } catch {
      setError("Verbindung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Passwort wurde geaendert. Bitte melde dich neu an.
        </p>
        <button
          className="btn btn-primary w-full"
          onClick={() => router.push("/login")}
        >
          Zur Anmeldung
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="block">
        <span className="text-sm font-medium">Benutzername</span>
        <input
          className="input mt-1"
          required
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Recovery-Code</span>
        <input
          className="input mt-1 uppercase tracking-widest"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Neues Passwort</span>
        <input
          className="input mt-1"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Neues Passwort bestaetigen</span>
        <input
          className="input mt-1"
          type="password"
          required
          minLength={8}
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
        {loading ? "Bitte warten..." : "Passwort zuruecksetzen"}
      </button>
    </form>
  );
}
