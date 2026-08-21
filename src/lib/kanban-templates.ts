import { useCallback, useMemo } from "react";
import { usePersistentState } from "@/lib/persistent-state";

/**
 * Saved Kanban column templates ("Sales flow", "Collections"…).
 *
 * A template is just an ordered list of column keys. Built-in templates ship
 * with the app; user templates are stored per browser profile alongside the
 * currently active template id.
 */

export interface KanbanTemplate {
  id: string;
  name: string;
  /** Ordered list of column keys shown on the board. */
  keys: string[];
  builtin?: boolean;
}

interface Stored {
  active: string;
  custom: KanbanTemplate[];
}

export function useKanbanTemplates(page: string, builtins: KanbanTemplate[]) {
  const [stored, setStored] = usePersistentState<Stored>(`kanban.templates.${page}`, {
    active: builtins[0]?.id ?? "all",
    custom: [],
  });

  const templates = useMemo<KanbanTemplate[]>(
    () => [...builtins.map((b) => ({ ...b, builtin: true })), ...(stored.custom ?? [])],
    [builtins, stored.custom],
  );

  const active = useMemo(
    () => templates.find((t) => t.id === stored.active) ?? templates[0],
    [templates, stored.active],
  );

  const setActive = useCallback((id: string) => setStored({ ...stored, active: id }), [stored, setStored]);

  const save = useCallback(
    (name: string, keys: string[]) => {
      const id = `u_${Date.now().toString(36)}`;
      setStored({ active: id, custom: [...(stored.custom ?? []), { id, name, keys }] });
      return id;
    },
    [stored, setStored],
  );

  const rename = useCallback(
    (id: string, name: string) =>
      setStored({ ...stored, custom: (stored.custom ?? []).map((t) => (t.id === id ? { ...t, name } : t)) }),
    [stored, setStored],
  );

  const remove = useCallback(
    (id: string) => {
      const custom = (stored.custom ?? []).filter((t) => t.id !== id);
      setStored({ custom, active: stored.active === id ? (builtins[0]?.id ?? "all") : stored.active });
    },
    [stored, setStored, builtins],
  );

  return { templates, active, setActive, save, rename, remove };
}
