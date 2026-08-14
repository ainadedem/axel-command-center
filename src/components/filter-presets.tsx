import { useState } from "react";
import { Bookmark, BookmarkPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FilterPreset, FilterPresetsApi } from "@/lib/filter-presets";

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Row of saved status + PO filter combinations with a save/delete control. */
export function FilterPresetBar({
  api,
  statuses,
  po,
  onApply,
  className,
}: {
  api: FilterPresetsApi;
  statuses: string[];
  po: string[];
  onApply: (preset: FilterPreset) => void;
  className?: string;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const canSave = statuses.length > 0 || po.length > 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {api.presets.length > 0 && (
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-0.5">Presets</span>
      )}
      {api.presets.map((p) => {
        const active = sameSet(p.statuses, statuses) && sameSet(p.po, po);
        return (
          <span key={p.id} className="inline-flex items-center">
            <button
              type="button"
              onClick={() => onApply(p)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-l-full border border-r-0 text-xs font-medium",
                "transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                active
                  ? "border-primary/50 text-primary bg-primary/15"
                  : "border-border text-muted-foreground bg-surface hover:bg-[var(--surface-container)] hover:text-foreground",
              )}
            >
              <Bookmark className="h-3.5 w-3.5" />
              {p.name}
            </button>
            <button
              type="button"
              onClick={() => api.remove(p.id)}
              aria-label={`Delete preset ${p.name}`}
              className={cn(
                "inline-flex items-center h-8 pl-1 pr-2 rounded-r-full border text-muted-foreground",
                "transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:text-destructive",
                active ? "border-primary/50 bg-primary/15" : "border-border bg-surface",
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canSave}
            className="h-8 px-2.5 rounded-full text-xs"
            title={canSave ? "Save the current filters as a preset" : "Pick filters first"}
          >
            <BookmarkPlus className="h-3.5 w-3.5 mr-1" /> Save preset
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2">
          <label htmlFor="preset-name" className="text-xs font-medium">
            Preset name
          </label>
          <Input
            id="preset-name"
            value={name}
            autoFocus
            placeholder="Overdue · PO missing"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                api.save(name, statuses, po);
                setName("");
                setOpen(false);
              }
            }}
          />
          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => {
              api.save(name, statuses, po);
              setName("");
              setOpen(false);
            }}
          >
            Save
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
