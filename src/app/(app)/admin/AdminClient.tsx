"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: number;
  username: string;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  householdCount: number;
}

interface AuditEntry {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  targetHouseholdId: number | null;
  createdAt: string;
}

export default function AdminClient({
  users,
  audit,
}: {
  users: AdminUser[];
  audit: AuditEntry[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<{ id: number; pwd: string } | null>(null);

  const filtered = useMemo(() => {
    if (!search) return users;
    return users.filter((u) =>
      u.username.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, users]);

  async function patchUser(userId: number, action: string, body: object = {}) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Aktion fehlgeschlagen.");
        return null;
      }
      router.refresh();
      return data.data;
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(userId: number, username: string) {
    if (!confirm(`User ${username} hart loeschen?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Konnte nicht loeschen.");
        return;
      }
      setInfo(
        `Geloescht. Verwaiste Haushalte: ${
          (data.data?.deletedHouseholds ?? []).length
        }`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(userId: number) {
    const pwd = prompt("Neues Passwort (mind. 8 Zeichen):");
    if (!pwd || pwd.length < 8) return;
    const result = await patchUser(userId, "reset-password", { newPassword: pwd });
    if (result) setTempPassword({ id: userId, pwd });
  }

  return (
    <div className="space-y-4">
      <h2 className="font-medium">Benutzer</h2>
      {info && <div className="card p-3 text-sm">{info}</div>}
      {error && <div className="card p-3 text-sm text-rose-600">{error}</div>}
      <input
        className="input"
        placeholder="Suche nach Benutzername"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left bg-neutral-100 dark:bg-neutral-800">
              <th className="px-3 py-2">Benutzer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Haushalte</th>
              <th className="px-3 py-2">Letzter Login</th>
              <th className="px-3 py-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <td className="px-3 py-2 font-medium">{u.username}</td>
                <td className="px-3 py-2">
                  {u.isBanned && <span className="badge mr-1">gesperrt</span>}
                  {u.isAdmin && <span className="badge">admin</span>}
                </td>
                <td className="px-3 py-2">{u.householdCount}</td>
                <td className="px-3 py-2 text-xs text-neutral-500">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString("de-CH")
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      className="btn btn-secondary text-xs"
                      onClick={() =>
                        patchUser(u.id, "ban", { banned: !u.isBanned })
                      }
                      disabled={busy}
                    >
                      {u.isBanned ? "Entsperren" : "Sperren"}
                    </button>
                    <button
                      className="btn btn-secondary text-xs"
                      onClick={() => patchUser(u.id, "admin", { isAdmin: !u.isAdmin })}
                      disabled={busy}
                    >
                      {u.isAdmin ? "Admin entziehen" : "Admin geben"}
                    </button>
                    <button
                      className="btn btn-secondary text-xs"
                      onClick={() => resetPassword(u.id)}
                      disabled={busy}
                    >
                      Passwort
                    </button>
                    <button
                      className="btn btn-danger text-xs"
                      onClick={() => deleteUser(u.id, u.username)}
                      disabled={busy}
                    >
                      Loeschen
                    </button>
                  </div>
                  {tempPassword?.id === u.id && (
                    <p className="text-xs mt-1 text-neutral-500">
                      Neues Passwort gesetzt: {tempPassword.pwd}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="px-3 py-2 font-medium bg-neutral-100 dark:bg-neutral-800">
          Audit-Log (zuletzt {audit.length})
        </h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Zeit</th>
              <th className="px-3 py-2 text-left">Aktion</th>
              <th className="px-3 py-2 text-left">Akteur</th>
              <th className="px-3 py-2 text-left">Ziel</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr
                key={a.id}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <td className="px-3 py-2 text-xs text-neutral-500">
                  {new Date(a.createdAt).toLocaleString("de-CH")}
                </td>
                <td className="px-3 py-2">{a.action}</td>
                <td className="px-3 py-2">{a.actor ?? "-"}</td>
                <td className="px-3 py-2">
                  {a.target ?? (a.targetHouseholdId ? `HH:${a.targetHouseholdId}` : "-")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
