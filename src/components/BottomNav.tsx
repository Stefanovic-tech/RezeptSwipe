"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const items = [
  { href: "/swipe", label: "Swipe", icon: "S" },
  { href: "/rezepte", label: "Rezepte", icon: "R" },
  { href: "/kochen", label: "Kochen", icon: "K" },
  { href: "/einkauf", label: "Einkauf", icon: "E" },
  { href: "/haushalt", label: "Haushalt", icon: "H" },
];

export default function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname() || "";
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(ev: PointerEvent) {
      if (!wrapRef.current?.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const navItems = isAdmin
    ? [...items, { href: "/admin", label: "Admin", icon: "A" }]
    : items;

  return (
    <nav className="fixed top-16 inset-x-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-3xl px-4 pt-2">
        <div ref={wrapRef} className="pointer-events-auto w-fit relative">
          {open ? (
            <div className="mt-2 min-w-52 rounded-xl border border-neutral-200 bg-neutral-50/95 dark:bg-neutral-950/95 dark:border-neutral-800 backdrop-blur shadow-lg overflow-hidden">
              <ul className="py-1">
                {navItems.map((item) => {
                  const active =
                    mounted && (pathname === item.href || pathname.startsWith(item.href + "/"));
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
          <button
            type="button"
            aria-expanded={open}
            aria-label="Menue oeffnen"
            onClick={() => setOpen((v) => !v)}
            className="h-12 w-12 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur shadow-md flex items-center justify-center"
          >
            <span className="sr-only">Menue</span>
            <span className="flex flex-col gap-1.5">
              <span className="block w-5 h-0.5 bg-neutral-700 dark:bg-neutral-200 rounded" />
              <span className="block w-5 h-0.5 bg-neutral-700 dark:bg-neutral-200 rounded" />
              <span className="block w-5 h-0.5 bg-neutral-700 dark:bg-neutral-200 rounded" />
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
