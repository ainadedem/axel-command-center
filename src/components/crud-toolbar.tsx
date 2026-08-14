import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCreateAction } from "@/lib/create-action";

export function CrudToolbar({
  count,
  label,
  onCreate,
  createLabel = "New",
  children,
}: {
  count: number;
  label: string;
  onCreate: () => void;
  /** Page-specific action label, e.g. "New invoice". */
  createLabel?: string;
  children?: ReactNode;
}) {
  // Listen for the topbar "New" button broadcast
  useCreateAction(onCreate);

  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground font-tnum">
        {count} {label}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Button size="sm" onClick={onCreate} className="gap-1.5" aria-label={createLabel}>
          <Plus className="h-4 w-4" /> {createLabel}
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({ label, onCreate, createLabel }: { label: string; onCreate: () => void; createLabel?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
      <p className="text-sm text-muted-foreground mb-4">No {label} yet.</p>
      <Button size="sm" onClick={onCreate} className="gap-1.5">
        <Plus className="h-4 w-4" /> {createLabel ?? `Create your first ${label.replace(/s$/, "")}`}
      </Button>
    </div>
  );
}
