"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "autograde-theme";

export type ThemeId = "indigo" | "violet" | "emerald" | "rose" | "amber" | "sky";

type ThemeMeta = {
  id: ThemeId;
  label: string;
  emoji: string;
};

export const THEME_OPTIONS: ThemeMeta[] = [
  { id: "indigo", label: "Indigo", emoji: "💠" },
  { id: "violet", label: "Violet", emoji: "🔮" },
  { id: "emerald", label: "Emerald", emoji: "🌿" },
  { id: "rose", label: "Rose", emoji: "🌸" },
  { id: "amber", label: "Amber", emoji: "✨" },
  { id: "sky", label: "Sky", emoji: "🩵" },
];

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") {
    return "indigo";
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw && THEME_OPTIONS.some((t) => t.id === raw)) {
    return raw as ThemeId;
  }
  return "indigo";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() =>
    typeof window !== "undefined" ? readStoredTheme() : "indigo",
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
