"use client";

import { useCallback, useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "tier-rank-theme";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const preferred: ThemeMode = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    root.classList.toggle("dark", preferred === "dark");
    setTheme(preferred);
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      const root = document.documentElement;
      root.classList.toggle("dark", next === "dark");
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggle, isReady };
}
