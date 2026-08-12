import { useEffect } from "react";

type ReconciledSelectionOptions<T> = {
  open: boolean;
  currentValue: string;
  options: T[];
  getId: (option: T) => string;
  allowEmpty?: boolean;
  loading?: boolean;
  /**
   * Edit mode: keep the saved value even when it is absent from the loaded
   * options list. Background hydration must never rewrite a stored selection.
   */
  preserve?: boolean;
  onChange: (nextValue: string) => void;
};

/**
 * Keeps a local select value aligned with a live options list.
 * If the current value disappears, the hook either clears it or
 * falls back to the first available option depending on allowEmpty.
 */
export function useReconciledSelection<T>({
  open,
  currentValue,
  options,
  getId,
  allowEmpty = false,
  loading = false,
  preserve = false,
  onChange,
}: ReconciledSelectionOptions<T>) {
  useEffect(() => {
    if (!open) return;
    if (loading) return;
    if (preserve && currentValue) return;

    const ids = options.map(getId).filter(Boolean);
    const hasCurrent = !!currentValue && ids.includes(currentValue);

    if (hasCurrent) return;

    if (ids.length === 0) {
      if (currentValue !== "") onChange("");
      return;
    }

    if (allowEmpty && currentValue === "") return;

    const nextValue = allowEmpty && !currentValue ? "" : ids[0];
    if (nextValue !== currentValue) onChange(nextValue);
  }, [open, currentValue, options, getId, allowEmpty, loading, preserve, onChange]);
}

