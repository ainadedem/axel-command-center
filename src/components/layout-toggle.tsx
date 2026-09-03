import { LayoutGrid, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Segmented control switching a page between its table and its board. */
export function LayoutToggle({
  value,
  onChange,
  className,
}: {
  value: "list" | "board";
  onChange: (v: "list" | "board") => void;
  className?: string;
}) {
  const options = [
    { key: "list" as const, label: "List", Icon: Rows3 },
    { key: "board" as const, label: "Board", Icon: LayoutGrid },
  ];
  return (
    <div role="group" aria-label="Layout" className={cn("inline-flex items-center rounded-full border border-border bg-surface p-0.5", className)}>
      {options.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full t-label font-medium",
            "transition-[background-color,color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === key ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
