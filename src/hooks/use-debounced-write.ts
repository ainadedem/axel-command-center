import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Inline text/number editing: local state updates on every keystroke so typing
 * is instant, while the database write fires once the user stops (default
 * 500ms). Never writes per keystroke.
 */
export function useDebouncedWrite<T>(
  value: T,
  commit: (next: T) => void,
  delay = 500,
): [T, (next: T) => void, () => void] {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const dirty = useRef(false);

  // Accept upstream changes while the field is not being edited.
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (dirty.current) {
      dirty.current = false;
      setDraft((cur) => {
        commitRef.current(cur);
        return cur;
      });
    }
  }, []);

  const onChange = useCallback(
    (next: T) => {
      dirty.current = true;
      setDraft(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        dirty.current = false;
        commitRef.current(next);
      }, delay);
    },
    [delay],
  );

  // Flush any pending edit when the field unmounts.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return [draft, onChange, flush];
}
