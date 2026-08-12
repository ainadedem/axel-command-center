import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type TextSize = "default" | "large" | "larger";

const THEME_KEY = "axel.theme";
const SIZE_KEY = "axel.textSize";

const SIZE_SCALE: Record<TextSize, string> = {
  default: "100%",
  large: "108%",
  larger: "118%",
};

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  resolvedTheme: "light" | "dark";
  textSize: TextSize;
  setTextSize: (s: TextSize) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key) as T | null;
    return raw && allowed.includes(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    readStored(THEME_KEY, ["light", "dark", "system"] as const, "system"),
  );
  const [textSize, setTextSizeState] = useState<TextSize>(() =>
    readStored(SIZE_KEY, ["default", "large", "larger"] as const, "default"),
  );
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Track live OS preference changes.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    setSystemDark(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.style.fontSize = SIZE_SCALE[textSize];
    document.documentElement.dataset["textSize"] = textSize;
  }, [textSize]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try { window.localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
  }, []);

  const setTextSize = useCallback((next: TextSize) => {
    setTextSizeState(next);
    try { window.localStorage.setItem(SIZE_KEY, next); } catch { /* storage unavailable */ }
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme, textSize, setTextSize }),
    [theme, setTheme, resolvedTheme, textSize, setTextSize],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback so components never crash outside the provider.
    return {
      theme: "system",
      setTheme: () => {},
      resolvedTheme: "light",
      textSize: "default",
      setTextSize: () => {},
    };
  }
  return ctx;
}

/** True when the user asked the OS to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
