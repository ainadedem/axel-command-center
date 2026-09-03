import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRib } from "@/lib/payment-details";

export interface PaymentInfo {
  bankName?: string;
  bankAccount?: string;
  bankSwift?: string;
  bankHolder?: string;
  bankCode?: string;
  branchCode?: string;
  accountNumber?: string;
  ribKey?: string;
  iban?: string;
  intlEnabled?: boolean;
  mobileEnabled?: boolean;
  mobileProvider?: string;
  mobileNumber?: string;
  mobileName?: string;
}

export interface PaymentFormState {
  bankName: string;
  bankHolder: string;
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  ribKey: string;
  bankSwift: string;
  iban: string;
  intlEnabled: boolean;
  mobileEnabled: boolean;
  mobileProvider: string;
  mobileNumber: string;
  mobileName: string;
}

export const emptyPayment: PaymentFormState = {
  bankName: "", bankHolder: "", bankCode: "", branchCode: "", accountNumber: "", ribKey: "",
  bankSwift: "", iban: "", intlEnabled: false, mobileEnabled: false,
  mobileProvider: "MVola", mobileNumber: "", mobileName: "",
};

/** Load an entity's stored payment info into form state. */
export function paymentFrom(e?: PaymentInfo | null): PaymentFormState {
  if (!e) return { ...emptyPayment };
  return {
    bankName: e.bankName ?? "",
    bankHolder: e.bankHolder ?? "",
    bankCode: e.bankCode ?? "",
    branchCode: e.branchCode ?? "",
    accountNumber: e.accountNumber ?? "",
    ribKey: e.ribKey ?? "",
    bankSwift: e.bankSwift ?? "",
    iban: e.iban ?? "",
    intlEnabled: Boolean(e.intlEnabled),
    mobileEnabled: Boolean(e.mobileEnabled),
    mobileProvider: e.mobileProvider ?? "MVola",
    mobileNumber: e.mobileNumber ?? "",
    mobileName: e.mobileName ?? "",
  };
}

/** Convert form state back into the entity fields. */
export function paymentValues(p: PaymentFormState): PaymentInfo {
  const rib = formatRib(p.bankCode, p.branchCode, p.accountNumber, p.ribKey);
  return {
    bankName: p.bankName.trim() || undefined,
    bankHolder: p.bankHolder.trim() || undefined,
    bankCode: p.bankCode.trim() || undefined,
    branchCode: p.branchCode.trim() || undefined,
    accountNumber: p.accountNumber.trim() || undefined,
    ribKey: p.ribKey.trim() || undefined,
    bankAccount: rib || p.iban.trim() || undefined,
    bankSwift: p.bankSwift.trim() || undefined,
    iban: p.iban.trim() || undefined,
    intlEnabled: p.intlEnabled,
    mobileEnabled: p.mobileEnabled,
    mobileProvider: p.mobileEnabled ? p.mobileProvider || undefined : undefined,
    mobileNumber: p.mobileEnabled ? p.mobileNumber.trim() || undefined : undefined,
    mobileName: p.mobileEnabled ? p.mobileName.trim() || undefined : undefined,
  };
}

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

export function PaymentDetailsFields({
  value,
  onChange,
  title = "Payment details & bank info",
}: {
  value: PaymentFormState;
  onChange: (next: PaymentFormState) => void;
  title?: string;
}) {
  const set = (patch: Partial<PaymentFormState>) => onChange({ ...value, ...patch });

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-3">
      <div className="t-label font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Account holder (Titulaire)</Label>
          <Input value={value.bankHolder} onChange={(e) => set({ bankHolder: e.target.value })} />
        </div>
        <div>
          <Label>Bank / Domiciliation</Label>
          <Input value={value.bankName} onChange={(e) => set({ bankName: e.target.value })} placeholder="BNI Madagascar" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <Label>Code banque</Label>
          <Input value={value.bankCode} inputMode="numeric" maxLength={5} placeholder="00008"
            onChange={(e) => set({ bankCode: digits(e.target.value, 5) })} />
        </div>
        <div>
          <Label>Code guichet</Label>
          <Input value={value.branchCode} inputMode="numeric" maxLength={5} placeholder="03016"
            onChange={(e) => set({ branchCode: digits(e.target.value, 5) })} />
        </div>
        <div>
          <Label>N° de compte</Label>
          <Input value={value.accountNumber} inputMode="numeric" maxLength={11} placeholder="05003013776"
            onChange={(e) => set({ accountNumber: digits(e.target.value, 11) })} />
        </div>
        <div>
          <Label>Clé RIB</Label>
          <Input value={value.ribKey} inputMode="numeric" maxLength={2} placeholder="43"
            onChange={(e) => set({ ribKey: digits(e.target.value, 2) })} />
        </div>
      </div>
      <p className="t-micro font-tnum text-muted-foreground">
        RIB: {formatRib(value.bankCode, value.branchCode, value.accountNumber, value.ribKey) || "—"}
      </p>

      <label className="flex items-center gap-2 t-label cursor-pointer select-none">
        <Checkbox checked={value.intlEnabled} onCheckedChange={(v) => set({ intlEnabled: !!v })} />
        International transfers (SWIFT / IBAN)
      </label>
      {value.intlEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>SWIFT / BIC</Label>
            <Input value={value.bankSwift} onChange={(e) => set({ bankSwift: e.target.value })} placeholder="BNMGMGMG" />
          </div>
          <div>
            <Label>IBAN / MG format</Label>
            <Input value={value.iban} onChange={(e) => set({ iban: e.target.value })} placeholder="MG46 00008 03016 05003013776 43" />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 t-label cursor-pointer select-none">
        <Checkbox checked={value.mobileEnabled} onCheckedChange={(v) => set({ mobileEnabled: !!v })} />
        Mobile money transfer
      </label>
      {value.mobileEnabled && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Provider</Label>
            <Select value={value.mobileProvider} onValueChange={(v) => set({ mobileProvider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MVola">MVola</SelectItem>
                <SelectItem value="Orange Money">Orange Money</SelectItem>
                <SelectItem value="Airtel Money">Airtel Money</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Phone number</Label>
            <Input value={value.mobileNumber} onChange={(e) => set({ mobileNumber: e.target.value })} placeholder="+261 34 12 345 67" />
          </div>
          <div>
            <Label>Account name</Label>
            <Input value={value.mobileName} onChange={(e) => set({ mobileName: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}
