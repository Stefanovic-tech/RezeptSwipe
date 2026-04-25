"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  useEffect(() => {
    setMounted(true);
  }, []);
  const navItems = isAdmin
    ? [...items, { href: "/admin", label: "Admin", icon: "A" }]
    : items;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-neutral-50/95 dark:bg-neutral-950/95 border-t border-neutral-200 dark:border-neutral-800 backdrop-blur">
      <ul
        className="grid max-w-3xl mx-auto"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const active =
            mounted && (pathname === item.href || pathname.startsWith(item.href + "/"));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center min-h-[56px] py-1 text-xs ${
                  active
                    ? "text-brand-600 dark:text-brand-300"
                    : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-md flex items-center justify-center font-semibold ${
                    active
                      ? "bg-brand-100 dark:bg-brand-900/30"
                      : "bg-neutral-200 dark:bg-neutral-800"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="mt-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}
