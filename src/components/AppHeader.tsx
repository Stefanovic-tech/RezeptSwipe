"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "./ThemeToggle";

interface HouseholdItem {
  id: number;
  name: string;
  role: "owner" | "member";
}

export default function AppHeader({
  user,
  currentHousehold,
  households,
}: {
  user: { username: string; isAdmin: boolean };
  currentHousehold: { id: number; name: string } | null;
  households: HouseholdItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function switchHousehold(id: number) {
    setSwitching(true);
    setOpen(false);
    try {
      await fetch("/api/household/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ householdId: id }),
      });
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-neutral-50/95 dark:bg-neutral-950/95 border-b border-neutral-200 dark:border-neutral-800 backdrop-blur">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/swipe" className="font-semibold text-lg shrink-0">
          RezeptSwipe
        </Link>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn btn-secondary text-sm truncate max-w-[60vw]"
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={switching}
          >
            {currentHousehold?.name ?? "Haushalt waehlen"}
          </button>
          {open && (
            <div className="absolute top-14 left-4 z-40 card p-2 w-72 max-h-[60vh] overflow-auto shadow-md">
              <ul className="flex flex-col">
                {households.map((h) => {
                  const active = h.id === currentHousehold?.id;
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => switchHousehold(h.id)}
                        className={`w-full text-left rounded-md px-3 py-2 text-sm flex items-center justify-between ${
                          active
                            ? "bg-brand-100 dark:bg-brand-900/30"
                            : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <span className="truncate">{h.name}</span>
                        <span className="badge ml-2">{h.role}</span>
                      </button>
                    </li>
                  );
                })}
                <li className="border-t border-neutral-200 dark:border-neutral-800 mt-2 pt-2">
                  <Link
                    href="/haushalt/einloesen"
                    className="block px-3 py-2 text-sm text-brand-600"
                    onClick={() => setOpen(false)}
                  >
                    + Haushalt per Code beitreten
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
        <Link
          href="/profil"
          className="btn btn-secondary text-sm px-3"
          aria-label={`Profil von ${user.username}`}
          title="Profil"
        >
          {user.username.slice(0, 2).toUpperCase()}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
