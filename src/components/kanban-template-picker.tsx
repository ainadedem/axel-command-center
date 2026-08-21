import { useState } from "react";
import { Check, LayoutTemplate, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { KanbanTemplate } from "@/lib/kanban-templates";
import { cn } from "@/lib/utils";

/** One-click switcher between saved Kanban column templates. */
export function KanbanTemplatePicker({
  templates,
  active,
  onSelect,
  onSave,
  onRename,
  onRemove,
  currentKeys,
}: {
  templates: KanbanTemplate[];
  active?: KanbanTemplate;
  onSelect: (id: string) => void;
  onSave: (name: string, keys: string[]) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  /** Columns currently on screen — captured by "Save current as template". */
  currentKeys: string[];
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0" title="Board column templates">
          <LayoutTemplate className="h-3.5 w-3.5" />
          <span className="hidden sm:inline max-w-[9rem] truncate">{active?.name ?? "Columns"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1.5">
        <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">Templates</div>
        <div className="max-h-64 overflow-y-auto">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-1 group">
              {renaming === t.id ? (
                <form
                  className="flex-1 flex items-center gap-1 px-1 py-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (renameValue.trim()) onRename(t.id, renameValue.trim());
                    setRenaming(null);
                  }}
                >
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-7 text-xs"
                  />
                  <Button type="submit" size="sm" className="h-7 px-2 text-xs">Save</Button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { onSelect(t.id); setOpen(false); }}
                    className={cn(
                      "flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-[var(--surface-container)] transition-colors",
                      active?.id === t.id && "bg-[var(--surface-container)]",
                    )}
                  >
                    <Check className={cn("h-3.5 w-3.5 shrink-0", active?.id === t.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{t.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-tnum">{t.keys.length}</span>
                  </button>
                  {!t.builtin && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label={`Rename ${t.name}`}
                        onClick={() => { setRenaming(t.id); setRenameValue(t.name); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${t.name}`}
                        onClick={() => onRemove(t.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <form
          className="flex items-center gap-1 border-t border-border mt-1.5 pt-1.5 px-1"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (!name) return;
            onSave(name, currentKeys);
            setNewName("");
            setOpen(false);
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Save current as…"
            className="h-7 text-xs"
          />
          <Button type="submit" size="sm" variant="ghost" className="h-7 px-2" aria-label="Save template">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
