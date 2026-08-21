import { useCallback, useEffect, useState } from "react";

/**
 * `useState` that remembers its value in localStorage.
 *
 * The initial render always returns `fallback` so server and client markup
 * match; the stored value is adopted right after hydration.
 */
export function usePersistentState<T>(key: string, fallback: T) {
  const storageKey = `axel.${key}`;
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* corrupted or unavailable storage — keep the fallback */
    }
  }, [storageKey]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage full or blocked — the value still applies for this session */
      }
    },
    [storageKey],
  );

  return [value, set] as const;
}
