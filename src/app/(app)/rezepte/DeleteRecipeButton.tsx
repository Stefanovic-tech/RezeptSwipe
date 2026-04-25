"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteRecipeButton({
  recipeId,
  label = "Loeschen",
}: {
  recipeId: number;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("Dieses Rezept wirklich loeschen?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        window.alert(json?.error?.message ?? "Loeschen fehlgeschlagen.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-danger text-xs px-2 py-1 shrink-0"
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void onClick();
      }}
    >
      {busy ? "..." : label}
    </button>
  );
}
