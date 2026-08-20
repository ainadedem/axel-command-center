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

function presetBtnBase(active?: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-l-full border border-r-0 text-xs font-medium",
    "transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    active
      ? "border-primary/50 text-primary bg-primary/15"
      : "border-border text-muted-foreground bg-surface hover:bg-[var(--surface-container)] hover:text-foreground",
  );
}

function presetOptsBase(active?: boolean) {
  return cn(
    "inline-flex items-center h-8 pl-1 pr-2 rounded-r-full border text-muted-foreground",
    "transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:text-foreground",
    active ? "border-primary/50 bg-primary/15" : "border-border bg-surface",
  );
}

/** Row of saved status + PO filter combinations with save/rename/update/delete. */
export function FilterPresetBar({
  api,
  statuses,
  po,
  onApply,
  className,
  flat = false,
  iconOnly = false,
}: {
  api: FilterPresetsApi;
  statuses: string[];
  po: string[];
  onApply: (preset: FilterPreset) => void;
  className?: string;
  flat?: boolean;
  iconOnly?: boolean;
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

  const activeCount = api.presets.filter(
    (p) => sameSet(p.statuses, statuses) && sameSet(p.po, po),
  ).length;

  // ---- iconOnly: collapse to a single Bookmark popover -------------------
  if (iconOnly) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Filter presets"
            aria-label="Filter presets"
            className={cn(
              "relative inline-flex items-center justify-center h-8 w-8 rounded-full border-0 bg-surface text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              activeCount > 0 && "text-primary bg-primary/10",
              className,
            )}
          >
            <Bookmark className="h-4 w-4" />
            {api.presets.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 font-tnum text-[9px] leading-none px-1 rounded-full bg-surface border border-border text-muted-foreground">
                {api.presets.length}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 py-1.5">Filter presets</div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {api.presets.length === 0 && (
              <div className="text-[11px] text-muted-foreground px-1 py-3 text-center">No saved presets yet</div>
            )}
            {api.presets.map((p) => {
              const active = sameSet(p.statuses, statuses) && sameSet(p.po, po);
              if (renamingId === p.id) {
                return (
                  <div key={p.id} className="flex items-center gap-1 px-1">
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
                      className="h-8 flex-1 rounded-full text-xs"
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
                  </div>
                );
              }
              return (
                <div key={p.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => { onApply(p); setOpen(false); }}
                    aria-pressed={active}
                    className={cn(presetBtnBase(active), "rounded-full")}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[140px]">{p.name}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Preset ${p.name} options`}
                        className={presetOptsBase(active)}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
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
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            <Input
              value={name}
              autoFocus
              disabled={!canSave}
              placeholder="Save current as…"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  api.save(name, statuses, po);
                  setName("");
                  setOpen(false);
                }
              }}
              className="h-8 rounded-full text-xs"
            />
            <Button
              size="sm"
              disabled={!canSave || !name.trim()}
              className="w-full h-8 text-xs mt-1.5 gap-1.5"
              onClick={() => {
                api.save(name, statuses, po);
                setName("");
                setOpen(false);
              }}
            >
              <BookmarkPlus className="h-3.5 w-3.5" /> Save preset
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // ---- default: full preset chips ---------------------------------------
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
              className={presetBtnBase(active)}
            >
              <Bookmark className="h-3.5 w-3.5" />
              {p.name}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Preset ${p.name} options`}
                  className={presetOptsBase(active)}
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
