"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";

interface HouseholdItem {
  id: number;
  name: string;
  role: "owner" | "member";
}

const navItems = [
  { href: "/swipe", label: "Swipe", icon: "S" },
  { href: "/rezepte", label: "Rezepte", icon: "R" },
  { href: "/kochen", label: "Kochen", icon: "K" },
  { href: "/einkauf", label: "Einkauf", icon: "E" },
  { href: "/haushalt", label: "Haushalt", icon: "H" },
];

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
  const pathname = usePathname() || "";
  const navRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const fullNav = user.isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: "A" }]
    : navItems;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(ev: PointerEvent) {
      if (!navRef.current?.contains(ev.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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
    <header className="sticky top-0 z-[220] bg-neutral-50/95 dark:bg-neutral-950/95 border-b border-neutral-200 dark:border-neutral-800 backdrop-blur">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <div ref={navRef} className="relative shrink-0">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label="Menue oeffnen"
            onClick={() => setMenuOpen((v) => !v)}
            className="h-11 w-11 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur shadow-sm flex items-center justify-center"
          >
            <span className="sr-only">Menue</span>
            <span className="flex flex-col gap-1.5">
              <span className="block w-5 h-0.5 bg-neutral-700 dark:bg-neutral-200 rounded" />
              <span className="block w-5 h-0.5 bg-neutral-700 dark:bg-neutral-200 rounded" />
              <span className="block w-5 h-0.5 bg-neutral-700 dark:bg-neutral-200 rounded" />
            </span>
          </button>
          {menuOpen ? (
            <div className="absolute left-0 top-12 z-50 min-w-56 max-h-[70vh] overflow-auto rounded-xl border border-neutral-200 bg-neutral-50/95 dark:bg-neutral-950/95 dark:border-neutral-800 backdrop-blur shadow-lg">
              <ul className="py-1">
                {fullNav.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 text-sm ${
                          active
                            ? "text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20"
                            : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold ${
                            active
                              ? "bg-brand-100 dark:bg-brand-900/40"
                              : "bg-neutral-200 dark:bg-neutral-800"
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
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
          Profil
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
