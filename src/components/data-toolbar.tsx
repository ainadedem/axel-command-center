import { useMemo, useState } from "react";
import { ArrowDownUp, ArrowDown, ArrowUp, Group, Filter, X, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { FieldDef, FilterValue, ViewState } from "@/hooks/use-data-view";

type AnyView = ReturnType<typeof import("@/hooks/use-data-view").useDataView<unknown>>;

type Props<T> = {
  view: {
    state: ViewState;
    setState: AnyView["setState"];
    reset: () => void;
    fields: FieldDef<T>[];
    activeFilterCount: number;
  };
  /** Optional source items to derive enum filter options from. */
  items?: T[];
  className?: string;
};

function chipBase() {
  return "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs border border-border bg-surface hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition";
}

export function DataToolbar<T>({ view, items, className }: Props<T>) {
  const { state, setState, reset, fields, activeFilterCount } = view;

  const sortableFields = fields.filter((f) => !f.noSort);
  const groupableFields = fields.filter((f) => !f.noGroup && (f.type === "enum" || f.type === "string" || f.type === "boolean"));
  const filterableFields = fields.filter((f) => !f.noFilter);

  const sortField = state.sort ? fields.find((f) => f.key === state.sort!.key) ?? null : null;
  const groupField = state.group ? fields.find((f) => f.key === state.group!.key) ?? null : null;

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={state.q}
          onChange={(e) => setState((p) => ({ ...p, q: e.target.value }))}
          placeholder="Search…"
          className="h-8 w-44 pl-7 text-xs"
        />
      </div>

      {/* Sort */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(chipBase(), sortField && "text-foreground border-primary/40 bg-primary/5")}>
            <ArrowDownUp className="h-3.5 w-3.5" />
            <span>Sort</span>
            {sortField && (
              <span className="text-foreground font-medium ml-1 flex items-center gap-0.5">
                {sortField.label}
                {state.sort?.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-2" align="start">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Sort by</div>
          <div className="max-h-72 overflow-y-auto">
            <button
              onClick={() => setState((p) => ({ ...p, sort: null }))}
              className={cn("w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface-elevated flex items-center justify-between", !state.sort && "text-foreground font-medium")}
            >
              <span>None</span>
              {!state.sort && <span className="text-[10px] text-muted-foreground">default</span>}
            </button>
            {sortableFields.map((f) => {
              const active = state.sort?.key === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setState((p) => ({
                    ...p,
                    sort: active && p.sort?.dir === "asc"
                      ? { key: f.key, dir: "desc" }
                      : active && p.sort?.dir === "desc"
                      ? null
                      : { key: f.key, dir: "asc" },
                  }))}
                  className={cn("w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface-elevated flex items-center justify-between", active && "text-foreground font-medium bg-primary/5")}
                >
                  <span>{f.label}</span>
                  {active && (state.sort?.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Group */}
      {groupableFields.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(chipBase(), groupField && "text-foreground border-primary/40 bg-primary/5")}>
              <Group className="h-3.5 w-3.5" />
              <span>Group</span>
              {groupField && <span className="text-foreground font-medium ml-1">{groupField.label}</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-2" align="start">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Group by</div>
            <div className="max-h-72 overflow-y-auto">
              <button
                onClick={() => setState((p) => ({ ...p, group: null }))}
                className={cn("w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface-elevated flex items-center justify-between", !state.group && "text-foreground font-medium")}
              >
                <span>None</span>
              </button>
              {groupableFields.map((f) => {
                const active = state.group?.key === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setState((p) => ({ ...p, group: active ? null : { key: f.key } }))}
                    className={cn("w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface-elevated", active && "text-foreground font-medium bg-primary/5")}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(chipBase(), activeFilterCount > 0 && "text-foreground border-primary/40 bg-primary/5")}>
            <Filter className="h-3.5 w-3.5" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center font-medium">
                {activeFilterCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 max-h-[70vh] overflow-y-auto" align="start">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Filters</div>
            {activeFilterCount > 0 && (
              <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground underline">
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-3">
            {filterableFields.map((f) => (
              <FilterField key={f.key} field={f} value={state.filters[f.key]} items={items ?? []}
                onChange={(v) => setState((p) => ({ ...p, filters: { ...p.filters, [f.key]: v } }))} />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {activeFilterCount > 0 && (
        <button onClick={reset} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}

function FilterField<T>({ field, value, items, onChange }: {
  field: FieldDef<T>;
  value: FilterValue | undefined;
  items: T[];
  onChange: (v: FilterValue | undefined) => void;
}) {
  if (field.type === "enum" || field.type === "string") {
    const options = useMemo(() => {
      if (field.enumOptions) return field.enumOptions;
      const set = new Set<string>();
      for (const it of items) {
        const v = field.accessor(it);
        if (v == null || v === "") continue;
        set.add(String(v));
      }
      return Array.from(set).sort();
    }, [items, field]);

    if (field.type === "string" && options.length > 12) {
      const v = value?.type === "text" ? value.value : "";
      return (
        <div>
          <Label className="text-xs">{field.label}</Label>
          <Input className="h-8 text-xs mt-1" value={v} onChange={(e) =>
            onChange(e.target.value ? { type: "text", value: e.target.value } : undefined)
          } placeholder="contains…" />
        </div>
      );
    }

    const selected = value?.type === "enum" ? value.values : [];
    const toggle = (opt: string) => {
      const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
      onChange(next.length ? { type: "enum", values: next } : undefined);
    };
    return (
      <div>
        <Label className="text-xs">{field.label}</Label>
        <div className="mt-1 grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-1">
          {options.length === 0 && <div className="text-[11px] text-muted-foreground">No values</div>}
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-surface-elevated rounded px-1.5 py-1">
              <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "number") {
    const v = value?.type === "number" ? value : { type: "number" as const };
    const update = (patch: Partial<typeof v>) => {
      const next = { ...v, ...patch };
      const hasVal = next.min != null || next.max != null;
      onChange(hasVal ? { type: "number", min: next.min, max: next.max } : undefined);
    };
    return (
      <div>
        <Label className="text-xs">{field.label}</Label>
        <div className="mt-1 flex gap-2">
          <Input className="h-8 text-xs" type="number" placeholder="Min" value={v.min ?? ""} onChange={(e) => update({ min: e.target.value === "" ? undefined : Number(e.target.value) })} />
          <Input className="h-8 text-xs" type="number" placeholder="Max" value={v.max ?? ""} onChange={(e) => update({ max: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </div>
      </div>
    );
  }

  if (field.type === "date") {
    const v = value?.type === "date" ? value : { type: "date" as const };
    const update = (patch: Partial<typeof v>) => {
      const next = { ...v, ...patch };
      const hasVal = next.from || next.to;
      onChange(hasVal ? { type: "date", from: next.from, to: next.to } : undefined);
    };
    return (
      <div>
        <Label className="text-xs">{field.label}</Label>
        <div className="mt-1 flex gap-2">
          <Input className="h-8 text-xs" type="date" value={v.from ?? ""} onChange={(e) => update({ from: e.target.value || undefined })} />
          <Input className="h-8 text-xs" type="date" value={v.to ?? ""} onChange={(e) => update({ to: e.target.value || undefined })} />
        </div>
      </div>
    );
  }

  if (field.type === "boolean") {
    const v = value?.type === "boolean" ? value.value : undefined;
    return (
      <div>
        <Label className="text-xs">{field.label}</Label>
        <div className="mt-1 flex gap-2">
          <Button size="sm" variant={v === true ? "default" : "outline"} className="h-7 text-xs" onClick={() => onChange(v === true ? undefined : { type: "boolean", value: true })}>Yes</Button>
          <Button size="sm" variant={v === false ? "default" : "outline"} className="h-7 text-xs" onClick={() => onChange(v === false ? undefined : { type: "boolean", value: false })}>No</Button>
        </div>
      </div>
    );
  }

  return null;
}

/** Renders a group header row inside a tbody. */
export function GroupHeaderRow({ label, count, colSpan }: { label: string; count: number; colSpan: number }) {
  return (
    <tr className="bg-surface-elevated/40 border-b border-border/60">
      <td colSpan={colSpan} className="px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
        {label} <span className="text-muted-foreground/60 ml-1.5">· {count}</span>
      </td>
    </tr>
  );
}
