import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { companyBankAccounts } from "@/lib/payment-details";
import type { Company } from "@/lib/mock-data";

/** Picks which of the company's bank accounts prints on this document. */
export function BankAccountSelect({
  company,
  value,
  onChange,
  label = "Bank account on document",
}: {
  company?: Company;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const accounts = companyBankAccounts(company);
  if (accounts.length === 0) {
    return (
      <div>
        <Label>{label}</Label>
        <p className="t-label text-muted-foreground mt-1">
          No bank account configured for this company yet — add one in Companies.
        </p>
      </div>
    );
  }
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value || accounts.find((a) => a.isDefault)?.id || accounts[0].id} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.label || a.bankName || "Bank account"}{a.isDefault ? " · default" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
