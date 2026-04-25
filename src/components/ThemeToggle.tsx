"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("rs-theme", theme);
  } catch {
    // ignore
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = (typeof window !== "undefined"
      ? localStorage.getItem("rs-theme")
      : null) as Theme | null;
    if (stored === "light" || stored === "dark") setTheme(stored);
    else if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setTheme("dark");
    }
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-secondary text-sm"
      aria-label="Theme wechseln"
    >
      {theme === "dark" ? "Hell" : "Dunkel"}
    </button>
  );
}
