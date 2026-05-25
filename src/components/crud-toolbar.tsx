import { Plus } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CREATE_EVENT } from "@/components/app-shell";

export function CrudToolbar({
  count,
  label,
  onCreate,
  children,
}: {
  count: number;
  label: string;
  onCreate: () => void;
  children?: React.ReactNode;
}) {
  // Listen for the topbar "New" button broadcast
  useEffect(() => {
    const handler = () => onCreate();
    window.addEventListener(CREATE_EVENT, handler);
    return () => window.removeEventListener(CREATE_EVENT, handler);
  }, [onCreate]);

  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground font-tnum">
        {count} {label}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Button size="sm" onClick={onCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>
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
