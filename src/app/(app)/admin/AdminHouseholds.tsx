"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface AdminHouseholdListItem {
  id: number;
  name: string;
  createdAt: string;
  memberCount: number;
  inviteCount: number;
  activeInviteCount: number;
  ownerUsername: string | null;
}

interface AdminHouseholdMember {
  userId: number;
  username: string;
  role: "owner" | "member";
  joinedAt: string;
}

interface AdminHouseholdInvite {
  id: number;
  codePreview: string | null;
  createdAt: string;
  createdByUsername: string | null;
  expiresAt: string | null;
  maxUses: number;
  usedCount: number;
  revokedAt: string | null;
}

interface AdminHouseholdDetail {
  id: number;
  name: string;
  createdAt: string;
  members: AdminHouseholdMember[];
  invites: AdminHouseholdInvite[];
  stats: {
    likedCount: number;
    customRecipeCount: number;
    cookingSessions: number;
    shoppingLists: number;
  };
}

function formatDate(s: string | null): string {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("de-CH");
  } catch {
    return s;
  }
}

export default function AdminHouseholds({
  initialHouseholds,
}: {
  initialHouseholds: AdminHouseholdListItem[];
}) {
  const router = useRouter();
  const [households, setHouseholds] = useState<AdminHouseholdListItem[]>(initialHouseholds);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminHouseholdDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [renameValue, setRenameValue] = useState("");
  const [createdInvite, setCreatedInvite] = useState<{ id: number; code: string } | null>(null);
  const [inviteMaxUses, setInviteMaxUses] = useState("1");
  const [inviteExpireDays, setInviteExpireDays] = useState("");

  const [transferUserId, setTransferUserId] = useState<number | null>(null);
  const [transferPassword, setTransferPassword] = useState("");

  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [mergeConfirmName, setMergeConfirmName] = useState("");
  const [mergePassword, setMergePassword] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return households;
    return households.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        String(h.id) === q ||
        h.ownerUsername?.toLowerCase().includes(q)
    );
  }, [households, search]);

  async function refreshList() {
    const res = await fetch("/api/admin/households", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) setHouseholds(data.data.items);
  }

  async function loadDetail(id: number) {
    setBusy(true);
    setError(null);
    setInfo(null);
    setCreatedInvite(null);
    try {
      const res = await fetch(`/api/admin/households/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Detail konnte nicht geladen werden.");
        return;
      }
      const d = data.data as AdminHouseholdDetail;
      setSelectedId(id);
      setDetail(d);
      setRenameValue(d.name);
      setDeleteConfirmName("");
      setDeletePassword("");
      setTransferUserId(null);
      setTransferPassword("");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (selectedId == null) setDetail(null);
  }, [selectedId]);

  async function postJson(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok && data.ok, data, status: res.status } as const;
  }

  async function rename() {
    if (!detail) return;
    const newName = renameValue.trim();
    if (!newName || newName === detail.name) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await postJson(`/api/admin/households/${detail.id}/rename`, {
        name: newName,
      });
      if (!res.ok) {
        setError(res.data?.error?.message ?? "Umbenennen fehlgeschlagen.");
        return;
      }
      setInfo("Haushalt umbenannt.");
      await refreshList();
      await loadDetail(detail.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setRole(userId: number, role: "owner" | "member") {
    if (!detail) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await postJson(
        `/api/admin/households/${detail.id}/members/${userId}/role`,
        { role }
      );
      if (!res.ok) {
        setError(res.data?.error?.message ?? "Rollenwechsel fehlgeschlagen.");
        return;
      }
      setInfo(role === "owner" ? "Member zu Owner befoerdert." : "Owner zu Member herabgestuft.");
      await loadDetail(detail.id);
      await refreshList();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function transfer() {
    if (!detail || transferUserId == null) return;
    if (!transferPassword) {
      setError("Bitte Admin-Passwort eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await postJson(
        `/api/admin/households/${detail.id}/transfer-owner`,
        { newOwnerUserId: transferUserId, password: transferPassword }
      );
      if (!res.ok) {
        setError(res.data?.error?.message ?? "Owner-Transfer fehlgeschlagen.");
        return;
      }
      setInfo("Owner uebertragen.");
      setTransferPassword("");
      setTransferUserId(null);
      await loadDetail(detail.id);
      await refreshList();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    if (!detail) return;
    const maxUsesNum = Math.max(1, Number(inviteMaxUses) || 1);
    const expireNum = inviteExpireDays.trim() ? Number(inviteExpireDays) : null;
    setBusy(true);
    setError(null);
    setInfo(null);
    setCreatedInvite(null);
    try {
      const res = await postJson(`/api/admin/households/${detail.id}/invites`, {
        maxUses: maxUsesNum,
        expiresInDays: expireNum && expireNum > 0 ? expireNum : null,
      });
      if (!res.ok) {
        setError(res.data?.error?.message ?? "Invite konnte nicht erstellt werden.");
        return;
      }
      setCreatedInvite(res.data.data);
      setInfo("Invite-Code erstellt. Bitte kopieren - wird nur einmal angezeigt.");
      await loadDetail(detail.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(inviteId: number) {
    if (!detail) return;
    if (!confirm("Invite wirklich widerrufen?")) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await postJson(
        `/api/admin/households/${detail.id}/invites/${inviteId}/revoke`,
        {}
      );
      if (!res.ok) {
        setError(res.data?.error?.message ?? "Widerrufen fehlgeschlagen.");
        return;
      }
      setInfo("Invite widerrufen.");
      await loadDetail(detail.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteHousehold() {
    if (!detail) return;
    if (deleteConfirmName.trim() !== detail.name.trim()) {
      setError("Bestaetigungsname stimmt nicht.");
      return;
    }
    if (!deletePassword) {
      setError("Bitte Admin-Passwort eingeben.");
      return;
    }
    if (!confirm(`Haushalt ${detail.name} (#${detail.id}) endgueltig loeschen?`)) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/households/${detail.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmName: deleteConfirmName,
          password: deletePassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Loeschen fehlgeschlagen.");
        return;
      }
      setInfo(`Haushalt ${data.data.name} geloescht.`);
      setSelectedId(null);
      setDetail(null);
      await refreshList();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function performMerge() {
    if (mergeSourceId == null || mergeTargetId == null) return;
    if (mergeSourceId === mergeTargetId) {
      setError("Quelle und Ziel duerfen nicht identisch sein.");
      return;
    }
    const source = households.find((h) => h.id === mergeSourceId);
    if (!source) {
      setError("Quell-Haushalt nicht gefunden.");
      return;
    }
    if (mergeConfirmName.trim() !== source.name.trim()) {
      setError("Bestaetigungsname stimmt nicht mit Quell-Haushalt ueberein.");
      return;
    }
    if (!mergePassword) {
      setError("Bitte Admin-Passwort eingeben.");
      return;
    }
    if (
      !confirm(
        `Daten von "${source.name}" (#${mergeSourceId}) in #${mergeTargetId} mergen und Quelle loeschen?`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await postJson(`/api/admin/households/merge`, {
        sourceId: mergeSourceId,
        targetId: mergeTargetId,
        confirmSourceName: mergeConfirmName,
        password: mergePassword,
      });
      if (!res.ok) {
        setError(res.data?.error?.message ?? "Merge fehlgeschlagen.");
        return;
      }
      const r = res.data.data;
      setInfo(
        `Merge erfolgreich. Mitglieder verschoben: ${r.movedMembers} (Duplikate: ${r.duplicateMembersResolved}), Rezepte: ${r.movedRecipes}, Swipe-States: ${r.movedRecipeStates}, Sessions: ${r.movedCookingSessions}, Listen: ${r.movedShoppingLists}, Invites: ${r.movedInvites}.`
      );
      setMergeOpen(false);
      setMergeSourceId(null);
      setMergeTargetId(null);
      setMergeConfirmName("");
      setMergePassword("");
      if (selectedId === r.sourceHouseholdId) {
        setSelectedId(null);
        setDetail(null);
      }
      await refreshList();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-medium">Haushalte ({households.length})</h2>
        <button
          className="btn btn-secondary text-xs ml-auto"
          onClick={() => {
            setMergeOpen((v) => !v);
            setError(null);
            setInfo(null);
          }}
          type="button"
        >
          {mergeOpen ? "Merge schliessen" : "Haushalte zusammenfuehren"}
        </button>
      </div>

      {info && <div className="card p-3 text-sm">{info}</div>}
      {error && <div className="card p-3 text-sm text-rose-600">{error}</div>}

      {mergeOpen && (
        <div className="card p-3 space-y-2">
          <h3 className="font-medium text-sm">Haushalte zusammenfuehren</h3>
          <p className="text-xs text-neutral-500">
            Quelle wird in Ziel migriert und anschliessend geloescht. Mitglieder, Custom-Rezepte,
            Swipe-Status, Koch-Sessions, Listen und Invites werden uebernommen.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-sm space-y-1">
              <span>Quelle</span>
              <select
                className="input"
                value={mergeSourceId ?? ""}
                onChange={(e) =>
                  setMergeSourceId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">- waehlen -</option>
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} (#{h.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span>Ziel</span>
              <select
                className="input"
                value={mergeTargetId ?? ""}
                onChange={(e) =>
                  setMergeTargetId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">- waehlen -</option>
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} (#{h.id})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm space-y-1 block">
            <span>Bestaetigung: Quell-Haushaltsname exakt eingeben</span>
            <input
              className="input"
              value={mergeConfirmName}
              onChange={(e) => setMergeConfirmName(e.target.value)}
              placeholder={
                mergeSourceId
                  ? households.find((h) => h.id === mergeSourceId)?.name ?? ""
                  : ""
              }
            />
          </label>
          <label className="text-sm space-y-1 block">
            <span>Admin-Passwort (Re-Auth)</span>
            <input
              className="input"
              type="password"
              value={mergePassword}
              onChange={(e) => setMergePassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button
            className="btn btn-danger text-sm"
            onClick={() => void performMerge()}
            disabled={busy}
          >
            Merge ausfuehren
          </button>
        </div>
      )}

      <input
        className="input"
        placeholder="Suche nach Haushalt, ID oder Owner"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card overflow-x-auto lg:col-span-1 max-h-[60vh] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-neutral-100 dark:bg-neutral-800 sticky top-0">
                <th className="px-2 py-2">Haushalt</th>
                <th className="px-2 py-2">M.</th>
                <th className="px-2 py-2">Inv.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const active = h.id === selectedId;
                return (
                  <tr
                    key={h.id}
                    className={`border-t border-neutral-200 dark:border-neutral-800 cursor-pointer ${
                      active
                        ? "bg-brand-50 dark:bg-brand-900/20"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    }`}
                    onClick={() => void loadDetail(h.id)}
                  >
                    <td className="px-2 py-2">
                      <div className="font-medium">{h.name}</div>
                      <div className="text-xs text-neutral-500">
                        #{h.id} - Owner: {h.ownerUsername ?? "-"}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs">{h.memberCount}</td>
                    <td className="px-2 py-2 text-xs">
                      {h.activeInviteCount}/{h.inviteCount}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-xs text-neutral-500">
                    Keine Haushalte gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {!detail ? (
            <div className="card p-4 text-sm text-neutral-500">
              Bitte Haushalt aus der Liste waehlen.
            </div>
          ) : (
            <>
              <div className="card p-3 space-y-2">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="font-medium">
                    {detail.name}{" "}
                    <span className="text-xs text-neutral-500">#{detail.id}</span>
                  </h3>
                  <span className="text-xs text-neutral-500">
                    angelegt {formatDate(detail.createdAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                  <span className="badge">Likes: {detail.stats.likedCount}</span>
                  <span className="badge">Custom-Rezepte: {detail.stats.customRecipeCount}</span>
                  <span className="badge">Sessions: {detail.stats.cookingSessions}</span>
                  <span className="badge">Listen: {detail.stats.shoppingLists}</span>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    className="input flex-1 min-w-[160px]"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={80}
                  />
                  <button
                    className="btn btn-secondary text-sm"
                    onClick={() => void rename()}
                    disabled={busy || !renameValue.trim() || renameValue.trim() === detail.name}
                  >
                    Umbenennen
                  </button>
                </div>
              </div>

              <div className="card p-3 space-y-2">
                <h4 className="font-medium text-sm">Mitglieder</h4>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-neutral-100 dark:bg-neutral-800">
                      <th className="px-2 py-1">User</th>
                      <th className="px-2 py-1">Rolle</th>
                      <th className="px-2 py-1">Beigetreten</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.members.map((m) => (
                      <tr
                        key={m.userId}
                        className="border-t border-neutral-200 dark:border-neutral-800"
                      >
                        <td className="px-2 py-1">
                          {m.username}{" "}
                          <span className="text-xs text-neutral-500">#{m.userId}</span>
                        </td>
                        <td className="px-2 py-1">
                          <span className="badge">{m.role}</span>
                        </td>
                        <td className="px-2 py-1 text-xs text-neutral-500">
                          {formatDate(m.joinedAt)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {m.role === "member" ? (
                            <button
                              className="btn btn-secondary text-xs"
                              onClick={() => void setRole(m.userId, "owner")}
                              disabled={busy}
                            >
                              Zum Owner
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary text-xs"
                              onClick={() => void setRole(m.userId, "member")}
                              disabled={busy}
                            >
                              Zu Member
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card p-3 space-y-2">
                <h4 className="font-medium text-sm">Owner uebertragen</h4>
                <p className="text-xs text-neutral-500">
                  Aktuelle Owner werden zu Member, der gewaehlte Member wird Owner. Re-Auth
                  erforderlich.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    className="input"
                    value={transferUserId ?? ""}
                    onChange={(e) =>
                      setTransferUserId(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">- Member waehlen -</option>
                    {detail.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.username} ({m.role})
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="password"
                    placeholder="Admin-Passwort"
                    value={transferPassword}
                    onChange={(e) => setTransferPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <button
                  className="btn btn-secondary text-sm"
                  onClick={() => void transfer()}
                  disabled={busy || transferUserId == null || !transferPassword}
                >
                  Owner uebertragen
                </button>
              </div>

              <div className="card p-3 space-y-2">
                <h4 className="font-medium text-sm">Invites</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="text-sm space-y-1">
                    <span>Max. Nutzungen</span>
                    <input
                      className="input"
                      value={inviteMaxUses}
                      onChange={(e) => setInviteMaxUses(e.target.value)}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="text-sm space-y-1">
                    <span>Ablauf (Tage, leer = kein Ablauf)</span>
                    <input
                      className="input"
                      value={inviteExpireDays}
                      onChange={(e) => setInviteExpireDays(e.target.value)}
                      inputMode="numeric"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      className="btn btn-primary text-sm w-full"
                      onClick={() => void createInvite()}
                      disabled={busy}
                    >
                      Invite generieren
                    </button>
                  </div>
                </div>
                {createdInvite && (
                  <div className="text-sm">
                    Neuer Code:{" "}
                    <code className="bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                      {createdInvite.code}
                    </code>
                  </div>
                )}
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-neutral-100 dark:bg-neutral-800">
                      <th className="px-2 py-1">Code</th>
                      <th className="px-2 py-1">Verwendung</th>
                      <th className="px-2 py-1">Ablauf</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.invites.map((i) => {
                      const active =
                        !i.revokedAt &&
                        (!i.expiresAt || new Date(i.expiresAt) > new Date()) &&
                        i.usedCount < i.maxUses;
                      return (
                        <tr
                          key={i.id}
                          className="border-t border-neutral-200 dark:border-neutral-800"
                        >
                          <td className="px-2 py-1">
                            <span className="text-xs">{i.codePreview ?? "-"}</span>
                          </td>
                          <td className="px-2 py-1 text-xs">
                            {i.usedCount}/{i.maxUses}
                          </td>
                          <td className="px-2 py-1 text-xs text-neutral-500">
                            {formatDate(i.expiresAt)}
                          </td>
                          <td className="px-2 py-1 text-xs">
                            {i.revokedAt ? (
                              <span className="badge">widerrufen</span>
                            ) : active ? (
                              <span className="badge">aktiv</span>
                            ) : (
                              <span className="badge">abgelaufen</span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {active && (
                              <button
                                className="btn btn-danger text-xs"
                                onClick={() => void revokeInvite(i.id)}
                                disabled={busy}
                              >
                                Widerrufen
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {detail.invites.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-2 py-2 text-xs text-neutral-500">
                          Keine Invites vorhanden.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="card p-3 space-y-2 border-rose-300 dark:border-rose-900">
                <h4 className="font-medium text-sm text-rose-600 dark:text-rose-400">
                  Gefahrenbereich: Haushalt loeschen
                </h4>
                <p className="text-xs text-neutral-500">
                  Loescht den Haushalt sowie alle abhaengigen Daten (Mitgliedschaften,
                  Custom-Rezepte, Swipes, Sessions, Listen, Invites). Re-Auth erforderlich.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className="input"
                    placeholder={`Tippe "${detail.name}" zur Bestaetigung`}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="Admin-Passwort"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <button
                  className="btn btn-danger text-sm"
                  onClick={() => void deleteHousehold()}
                  disabled={
                    busy ||
                    deleteConfirmName.trim() !== detail.name.trim() ||
                    !deletePassword
                  }
                >
                  Haushalt endgueltig loeschen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
