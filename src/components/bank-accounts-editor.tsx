import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Star, Trash2 } from "lucide-react";
import { PaymentDetailsFields, paymentFrom, paymentValues, emptyPayment } from "@/components/payment-details-fields";
import type { CompanyBankAccount } from "@/lib/mock-data";

const newBankId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `bank-${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Editable list of a company's bank accounts, one of which is the default. */
export function BankAccountsEditor({
  value,
  onChange,
}: {
  value: CompanyBankAccount[];
  onChange: (next: CompanyBankAccount[]) => void;
}) {
  const update = (id: string, patch: Partial<CompanyBankAccount>) =>
    onChange(value.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const add = () =>
    onChange([
      ...value,
      { id: newBankId(), label: "", ...paymentValues(emptyPayment), isDefault: value.length === 0 },
    ]);

  const remove = (id: string) => {
    const next = value.filter((a) => a.id !== id);
    if (next.length > 0 && !next.some((a) => a.isDefault)) next[0] = { ...next[0], isDefault: true };
    onChange(next);
  };

  const setDefault = (id: string) => onChange(value.map((a) => ({ ...a, isDefault: a.id === id })));

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="t-label text-muted-foreground">
          No bank account yet. Add one to print payment details on invoices, quotes and POs.
        </p>
      )}
      {value.map((acc, i) => (
        <div key={acc.id} className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Label</Label>
              <Input
                value={acc.label}
                onChange={(e) => update(acc.id, { label: e.target.value })}
                placeholder={`Bank account ${i + 1}`}
              />
            </div>
            <Button
              type="button"
              variant={acc.isDefault ? "default" : "outline"}
              size="sm"
              onClick={() => setDefault(acc.id)}
            >
              <Star className="h-3.5 w-3.5 mr-1" />
              {acc.isDefault ? "Default" : "Set default"}
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => remove(acc.id)} aria-label="Remove bank account">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <PaymentDetailsFields
            title="Bank details"
            value={paymentFrom(acc)}
            onChange={(next) => update(acc.id, paymentValues(next))}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add bank account
      </Button>
    </div>
  );
}
