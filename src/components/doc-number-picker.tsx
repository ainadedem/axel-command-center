import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { fmtCompact, type Currency } from "@/lib/mock-data";
import { normalizeDocNumber } from "@/lib/doc-number-link";

export interface PickableDoc {
  id: string;
  number: string;
  status?: string;
  issueDate?: string;
  amount?: number;
  currency?: Currency;
  clientName?: string;
}

/**
 * Searchable document picker: type any part of a number (or client name), or
 * paste a full number, to link a document. Replaces the plain select so
 * historical documents can be found by their number.
 */
export function DocNumberPicker({
  value,
  onChange,
  docs,
  placeholder = "Search by number",
  disabled,
  emptyLabel = "— None —",
  companyLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  docs: PickableDoc[];
  placeholder?: string;
  disabled?: boolean;
  emptyLabel?: string;
  companyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = docs.find((d) => d.id === value);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return docs;
    const nq = normalizeDocNumber(q);
    const lq = q.toLowerCase();
    return docs.filter(
      (d) =>
        (nq && normalizeDocNumber(d.number).includes(nq)) ||
        d.clientName?.toLowerCase().includes(lq) ||
        String(d.amount ?? "").includes(q),
    );
  }, [docs, query]);

  // Pasting an exact number selects it straight away.
  const exact = useMemo(() => {
    const nq = normalizeDocNumber(query);
    if (nq.length < 4) return undefined;
    return docs.find((d) => normalizeDocNumber(d.number) === nq);
  }, [docs, query]);

  const pick = (id: string) => { onChange(id); setOpen(false); setQuery(""); };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected
              ? `${selected.number}${selected.amount != null && selected.currency ? ` · ${fmtCompact(selected.amount, selected.currency)}` : ""}${selected.status ? ` · ${selected.status}` : ""}`
              : placeholder}
          </span>
          <span className="flex items-center gap-1">
            {selected && (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onChange(""); }}
                aria-label="Clear"
              />
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === "Enter" && exact) { e.preventDefault(); pick(exact.id); } }}
          />
          <CommandList>
            <CommandEmpty>
              {query.trim()
                ? `No document with this number${companyLabel ? ` in ${companyLabel}` : ""}.`
                : "Nothing to link yet."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => pick("")}>
                <Check className={cn("mr-2 h-3.5 w-3.5", value ? "opacity-0" : "opacity-100")} />
                {emptyLabel}
              </CommandItem>
              {filtered.map((d) => (
                <CommandItem key={d.id} value={d.id} onSelect={() => pick(d.id)}>
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === d.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{d.number}</span>
                    {d.clientName ? <span className="text-muted-foreground"> · {d.clientName}</span> : null}
                    {d.issueDate ? <span className="text-muted-foreground"> · {d.issueDate}</span> : null}
                  </span>
                  <span className="ml-2 shrink-0 t-label text-muted-foreground font-tnum">
                    {d.amount != null && d.currency ? fmtCompact(d.amount, d.currency) : ""}
                    {d.status ? ` · ${d.status}` : ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
