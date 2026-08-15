import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCreateAction } from "@/lib/create-action";
import { ListEmptyState } from "@/components/list-state";


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
        <Button size="sm" onClick={onCreate} className="btn-new gap-1.5" aria-label={createLabel}>
          <Plus className="h-4 w-4" /> {createLabel}
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({ label, onCreate, createLabel }: { label: string; onCreate: () => void; createLabel?: string }) {
  return <ListEmptyState label={label} onCreate={onCreate} createLabel={createLabel} />;
}

