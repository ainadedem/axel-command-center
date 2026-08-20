import { useState } from "react";
import { Bookmark, BookmarkPlus, Check, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FilterPreset, FilterPresetsApi } from "@/lib/filter-presets";

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Row of saved status + PO filter combinations with save/rename/update/delete. */
export function FilterPresetBar({
  api,
  statuses,
  po,
  onApply,
  className,
  flat = false,
}: {
  api: FilterPresetsApi;
  statuses: string[];
  po: string[];
  onApply: (preset: FilterPreset) => void;
  className?: string;
  flat?: boolean;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const canSave = statuses.length > 0 || po.length > 0;

  const commitRename = () => {
    if (renamingId) api.rename(renamingId, renameValue);
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div className={cn(flat ? "[display:contents]" : "flex flex-wrap items-center gap-1.5", className)}>
      {api.presets.length > 0 && (
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-0.5">Presets</span>
      )}
      {api.presets.map((p) => {
        const active = sameSet(p.statuses, statuses) && sameSet(p.po, po);

        if (renamingId === p.id) {
          return (
            <span key={p.id} className="inline-flex items-center gap-1">
              <Input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                }}
                aria-label={`Rename preset ${p.name}`}
                className="h-8 w-36 rounded-full text-xs"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={commitRename}
                aria-label="Save preset name"
                className="inline-flex items-center h-8 px-2 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        }

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Preset ${p.name} options`}
                  className={cn(
                    "inline-flex items-center h-8 pl-1 pr-2 rounded-r-full border text-muted-foreground",
                    "transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:text-foreground",
                    active ? "border-primary/50 bg-primary/15" : "border-border bg-surface",
                  )}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  className="text-xs"
                  onSelect={() => { setRenamingId(p.id); setRenameValue(p.name); }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs"
                  disabled={!canSave}
                  onSelect={() => api.update(p.id, statuses, po)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Update from filters
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs text-destructive" onSelect={() => api.remove(p.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
