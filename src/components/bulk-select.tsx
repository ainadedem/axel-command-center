import { useCallback, useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkSelection<T> {
  selectedIds: string[];
  selectedRows: T[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
  allSelected: boolean;
  someSelected: boolean;
  selectableIds: string[];
  count: number;
}

/**
 * Row selection for tables. Selection is scoped to the rows currently visible
 * (post filter/search) and self-heals when rows disappear.
 */
export function useBulkSelection<T extends { id: string }>(
  rows: T[],
  isSelectable: (row: T) => boolean = () => true,
): BulkSelection<T> {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const selectable = useMemo(() => rows.filter(isSelectable), [rows, isSelectable]);
  const selectableIds = useMemo(() => selectable.map((r) => r.id), [selectable]);
  const visible = useMemo(() => new Set(selectableIds), [selectableIds]);

  // Drop selections for rows that are no longer visible/selectable.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visible]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const all = selectableIds.length > 0 && selectableIds.every((id) => prev.has(id));
      return all ? new Set() : new Set(selectableIds);
    });
  }, [selectableIds]);

  const selectedRows = useMemo(() => selectable.filter((r) => selected.has(r.id)), [selectable, selected]);

  return {
    selectedIds: selectedRows.map((r) => r.id),
    selectedRows,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected: selected.size > 0,
    selectableIds,
    count: selectedRows.length,
  };
}

export function SelectAllHeaderCell({
  checked,
  onToggle,
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <th className={cn("bulk-select-cell px-3 py-3 w-10", className)}>
      <Checkbox checked={checked} onCheckedChange={() => onToggle()} aria-label="Select all rows" />
    </th>
  );
}

export function SelectRowCell({
  checked,
  onToggle,
  disabled,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <td className="bulk-select-cell px-3 py-1.5 w-10">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={() => onToggle()}
        aria-label={label ?? "Select row"}
        title={disabled ? "Read-only company" : undefined}
      />
    </td>
  );
}

/** Floating action bar shown while rows are selected. */
export function BulkActionBar({
  count,
  noun,
  onClear,
  children,
}: {
  count: number;
  noun: string;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-surface-elevated/95 backdrop-blur px-4 py-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150">
        <span className="text-xs font-medium">
          {count} {noun}
          {count !== 1 ? "s" : ""} selected
        </span>
        <span className="h-4 w-px bg-border" />
        {children}
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
          <X className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
      </div>
    </div>
  );
}
