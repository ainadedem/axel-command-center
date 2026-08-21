import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles, X } from "lucide-react";
import { useInvoices, useTransactions } from "@/lib/mock-data";
import { suggestClientTerms, type ProofInvoice, type ProofTransaction } from "@/lib/payment-proof";

const CURRENCIES = ["MGA", "EUR", "USD"];

/**
 * Payment terms editor: the client's default terms plus optional per-currency
 * overrides, each with a one-click suggestion learned from the receipts we have
 * already matched for that client.
 */
export function ClientTermsFields({
  clientId,
  termsDays,
  onTermsDays,
  byCurrency,
  onByCurrency,
  disabled,
}: {
  clientId?: string;
  termsDays: string;
  onTermsDays: (v: string) => void;
  byCurrency: Record<string, number>;
  onByCurrency: (v: Record<string, number>) => void;
  disabled?: boolean;
}) {
  const invoices = useInvoices();
  const transactions = useTransactions();
  const [adding, setAdding] = useState<string>("");

  const suggestions = useMemo(() => {
    if (!clientId) return [];
    return suggestClientTerms(
      invoices as unknown as ProofInvoice[],
      transactions as unknown as ProofTransaction[],
    ).filter((s) => s.clientId === clientId);
  }, [clientId, invoices, transactions]);

  const overall = suggestions.find((s) => !s.currency);
  const suggestionFor = (cur: string) => suggestions.find((s) => s.currency === cur);
  const usedCurrencies = Object.keys(byCurrency);
  const addable = CURRENCIES.filter((c) => !usedCurrencies.includes(c));

  const setCur = (cur: string, value: string) => {
    const n = Number(value);
    const next = { ...byCurrency };
    if (!value.trim() || !Number.isFinite(n) || n <= 0) delete next[cur];
    else next[cur] = Math.round(n);
    onByCurrency(next);
  };

  return (
    <div className="space-y-2">
      <Label>Payment terms (days)</Label>
      <Input
        type="number"
        min="0"
        value={termsDays}
        onChange={(e) => onTermsDays(e.target.value)}
        placeholder="30"
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">
        Used to match bank receipts to the right invoice when amounts repeat monthly.
      </p>

      {overall && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onTermsDays(String(overall.days))}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-colors disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Suggested {overall.days} days
          <span className="opacity-70">
            · {overall.samples} payments, ±{overall.spreadDays}d
          </span>
        </button>
      )}

      {usedCurrencies.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-medium text-muted-foreground">Per-currency overrides</p>
          {usedCurrencies.map((cur) => {
            const s = suggestionFor(cur);
            return (
              <div key={cur} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs font-medium">{cur}</span>
                <Input
                  type="number"
                  min="0"
                  className="h-8 w-24"
                  value={String(byCurrency[cur] ?? "")}
                  onChange={(e) => setCur(cur, e.target.value)}
                  disabled={disabled}
                />
                {s && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setCur(cur, String(s.days))}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    use {s.days}d ({s.samples})
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${cur} override`}
                  onClick={() => {
                    const next = { ...byCurrency };
                    delete next[cur];
                    onByCurrency(next);
                  }}
                  className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {addable.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <Select value={adding} onValueChange={setAdding} disabled={disabled}>
            <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Currency" /></SelectTrigger>
            <SelectContent>
              {addable.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}{suggestionFor(c) ? ` · ~${suggestionFor(c)!.days}d` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || !adding}
            onClick={() => {
              if (!adding) return;
              const s = suggestionFor(adding);
              onByCurrency({ ...byCurrency, [adding]: s?.days ?? Number(termsDays) || 30 });
              setAdding("");
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add override
          </Button>
        </div>
      )}
    </div>
  );
}
