import { useState } from "react";
import { Check, ChevronDown, Users, X } from "lucide-react";
import { Avatar } from "@/components/avatar-upload";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCompanySalesUsers } from "@/hooks/use-company-users";
import { MAX_QUOTE_ASSIGNEES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface Props {
  companyId: string | undefined;
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

/** Multi-select for the (max 3) sales people following a quotation. */
export function QuoteAssigneePicker({ companyId, value, onChange, className }: Props) {
  const { users, loading } = useCompanySalesUsers(companyId);
  const [open, setOpen] = useState(false);
  const selected = users.filter((u) => value.includes(u.userId));
  const atMax = value.length >= MAX_QUOTE_ASSIGNEES;

  const toggle = (userId: string) => {
    if (value.includes(userId)) onChange(value.filter((v) => v !== userId));
    else if (!atMax) onChange([...value, userId]);
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Assign sales people to this quotation"
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm flex items-center justify-between gap-2 hover:border-primary/40 transition"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-left">
                {selected.length === 0
                  ? (companyId ? "Nobody assigned" : "Select a company first")
                  : selected.map((u) => u.name).join(", ")}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-1">
          <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            Up to {MAX_QUOTE_ASSIGNEES} people · {value.length} selected
          </div>
          {loading && <div className="px-2 py-3 text-xs text-muted-foreground">Loading people…</div>}
          {!loading && users.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              No users with sales access to this company yet.
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {users.map((u) => {
              const on = value.includes(u.userId);
              return (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => toggle(u.userId)}
                  disabled={!on && atMax}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-2 rounded text-left text-sm hover:bg-surface-elevated transition disabled:opacity-40 disabled:cursor-not-allowed",
                    on && "bg-primary/5",
                  )}
                >
                  <Avatar src={u.avatarUrl ?? undefined} name={u.name} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{u.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{u.role.replace(/_/g, " ")}</span>
                  </span>
                  {on && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((u) => (
            <span key={u.userId} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border border-border bg-surface-elevated text-xs">
              <Avatar src={u.avatarUrl ?? undefined} name={u.name} size={18} />
              <span className="truncate max-w-[9rem]">{u.name}</span>
              <button
                type="button"
                aria-label={`Remove ${u.name}`}
                onClick={() => toggle(u.userId)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact read-only avatar stack used in list rows. */
export function AssigneeStack({ companyId, ids }: { companyId: string; ids: string[] }) {
  const { users } = useCompanySalesUsers(companyId);
  if (!ids.length) return <span className="text-muted-foreground/50 text-xs">—</span>;
  const people = ids.map((id) => users.find((u) => u.userId === id) ?? { userId: id, name: "…", avatarUrl: null });
  return (
    <span className="flex items-center -space-x-2">
      {people.map((p) => (
        <span key={p.userId} title={p.name} className="ring-2 ring-background rounded-full">
          <Avatar src={p.avatarUrl ?? undefined} name={p.name} size={22} />
        </span>
      ))}
    </span>
  );
}
