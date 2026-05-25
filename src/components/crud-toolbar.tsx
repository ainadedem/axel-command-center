import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CrudToolbar({
  count,
  label,
  onCreate,
}: {
  count: number;
  label: string;
  onCreate: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground font-tnum">
        {count} {label}
      </div>
      <Button size="sm" onClick={onCreate} className="gap-1.5">
        <Plus className="h-4 w-4" /> New
      </Button>
    </div>
  );
}

export function EmptyState({ label, onCreate }: { label: string; onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
      <p className="text-sm text-muted-foreground mb-4">No {label} yet.</p>
      <Button size="sm" onClick={onCreate} className="gap-1.5">
        <Plus className="h-4 w-4" /> Create your first {label.replace(/s$/, "")}
      </Button>
    </div>
  );
}
