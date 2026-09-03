import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAllPcgAccounts } from "@/lib/pcg";
import { cn } from "@/lib/utils";

export function PcgAccountSelect({
  value,
  onChange,
  placeholder = "Compte",
  className,
}: {
  value?: string;
  onChange: (code: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const accounts = useAllPcgAccounts();
  const selected = useMemo(() => accounts.find((a) => a.code === value), [accounts, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-2 text-xs text-left transition hover:bg-surface-elevated/50 focus:outline-none focus:ring-1 focus:ring-ring",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selected ? `${selected.code} — ${selected.name}` : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const q = search.trim().toLowerCase();
            if (!q) return 1;
            const [code, ...rest] = itemValue.split("|");
            const name = rest.join("|");
            if (code.startsWith(q)) return 1;
            if (name.includes(q)) return 0.5;
            return 0;
          }}
        >
          <CommandInput placeholder="Rechercher un compte…" className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty>Aucun compte trouvé.</CommandEmpty>
            <CommandGroup>
              {accounts.map((a) => (
                <CommandItem
                  key={a.code}
                  value={`${a.code}|${a.name.toLowerCase()}`}
                  onSelect={() => {
                    onChange(a.code);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      value === a.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-tnum mr-2">{a.code}</span>
                  <span className="truncate">{a.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
