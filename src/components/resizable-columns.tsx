import { useEffect, useRef, useState } from "react";

export function useResizableColumns(storageKey: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch { /* ignore */ }
  }, [storageKey, widths]);

  const startResize = (key: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widths[key] ?? defaults[key] ?? 120;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(60, startW + (ev.clientX - startX));
      setWidths((w) => ({ ...w, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const resetWidths = () => setWidths(defaults);

  return { widths, startResize, resetWidths };
}

export function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-1/2 -translate-y-1/2 right-0 h-5 w-1.5 cursor-col-resize rounded-full bg-transparent hover:bg-primary/60 active:bg-primary transition-colors"
      aria-label="Resize column"
    />
  );
}
