"use client";

import { useState } from "react";

export default function RedeemForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/household/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Konnte Code nicht einloesen.");
        return;
      }
      window.location.assign("/swipe");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <label className="block">
        <span className="text-sm font-medium">Invite-Code</span>
        <input
          className="input mt-1 uppercase tracking-widest"
          required
          autoCapitalize="characters"
          autoCorrect="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <button className="btn btn-primary w-full" disabled={busy} type="submit">
        Einloesen
      </button>
    </form>
  );
}
