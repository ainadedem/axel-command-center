import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useCompanies, useAccounts, useTransactions,
  companiesStore, toMGA, fmtCompact, type Company, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2 } from "lucide-react";
import { markCompanyDocumentsDirty } from "@/lib/stamp-refresh";
import { AvatarUpload } from "@/components/avatar-upload";
import { supabase } from "@/integrations/supabase/client";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { Checkbox } from "@/components/ui/checkbox";
import { BankAccountsEditor } from "@/components/bank-accounts-editor";
import { companyBankAccounts } from "@/lib/payment-details";
import type { CompanyBankAccount, CompanyLogoCrop, StampPosition } from "@/lib/mock-data";
import { Slider } from "@/components/ui/slider";
import { LogoCropDialog } from "@/components/logo-crop-dialog";
import { useFileUrl } from "@/hooks/use-file-url";


export const Route = createFileRoute("/_authenticated/companies")({ component: CompaniesPage });

const PALETTE = [
  // Row 1
  "#5B5BD6", // indigo
  "#3B82F6", // blue
  "#1E9FE0", // sky
  "#16A394", // teal
  "#2EC4B6", // mint
  "#0F7A3E", // green
  "#E8A317", // amber
  "#DD6B20", // orange
  // Row 2
  "#D9342B", // red
  "#E84A8E", // pink
  "#B95FD9", // purple
  "#A88876", // taupe
  "#4D5666", // slate
  "#8593A8", // light slate
  "#1F2937", // charcoal (extra)
  "#6B7280", // gray (extra)
  // Corporate / muted
  "oklch(0.38 0.08 250)", // navy
  "oklch(0.45 0.06 250)", // steel blue
  "oklch(0.35 0.04 260)", // graphite
  "oklch(0.55 0.10 30)",  // brick
  "oklch(0.50 0.08 145)", // forest
  "oklch(0.60 0.09 85)",  // bronze
  "oklch(0.42 0.05 280)", // indigo
  "oklch(0.30 0.02 250)", // charcoal
];

function CompaniesPage() {
  const companies = useCompanies();
  const accounts = useAccounts();
  const transactions = useTransactions();
  const [editing, setEditing] = useState<Company | null>(null);
  const [open, setOpen] = useState(false);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Company) => { setEditing(c); setOpen(true); };

  return (
    <AppShell>
      <PageHeader title="Companies" description="Group entities under your control." />
      <div className="p-4 sm:p-8 space-y-5">
        <CrudToolbar createLabel="New company" count={companies.length} label="companies" onCreate={openCreate} />
        {companies.length === 0 ? (
          <EmptyState label="companies" onCreate={openCreate} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {companies.map((c) => {
              const cAcc = accounts.filter((a) => a.companyId === c.id);
              const cTx = transactions.filter((t) => t.companyId === c.id);
              const cash = cAcc.reduce((s, a) => s + toMGA(a.balance, a.currency), 0);
              const income = cTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
              const expense = cTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
              return (
                <div key={c.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 hover:border-primary/40 transition group">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-10 w-10 rounded-lg grid place-items-center text-sm font-display font-bold text-primary-foreground" style={{ background: c.color }}>
                      {c.shortName}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">Base · {c.baseCurrency}</div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                      <button onClick={() => openEdit(c)} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={async () => { if (confirm(`Delete ${c.name}?`)) { companiesStore.remove(c.id); await supabase.from("companies").delete().eq("code", (c.code || c.shortName || "").toUpperCase()); } }} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <Row label="Cash" value={fmtCompact(cash, "MGA")} accent />
                    <Row label="Income · 30d" value={fmtCompact(income, "MGA")} />
                    <Row label="Spend · 30d" value={fmtCompact(expense, "MGA")} />
                    <Row label="Net" value={fmtCompact(income - expense, "MGA")} accent={income - expense >= 0} />
                    <Row label="Accounts" value={cAcc.length.toString()} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <CompanyDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppShell>
  );
}

function CompanyDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Company | null }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [baseCurrency, setBaseCurrency] = useState<Currency>("MGA");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [nif, setNif] = useState("");
  const [stat, setStat] = useState("");
  const [rcs, setRcs] = useState("");
  const [taxId, setTaxId] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankSwift, setBankSwift] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ribKey, setRibKey] = useState("");
  const [iban, setIban] = useState("");
  const [intlEnabled, setIntlEnabled] = useState(false);
  const [mobileEnabled, setMobileEnabled] = useState(false);
  const [mobileProvider, setMobileProvider] = useState("MVola");
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileName, setMobileName] = useState("");
  const [showPaymentDetails, setShowPaymentDetails] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [logoHeight, setLogoHeight] = useState(52);
  const [logoMaxWidth, setLogoMaxWidth] = useState(180);
  const [docLanguage, setDocLanguage] = useState<"en" | "fr">("en");
  const [logoCrop, setLogoCrop] = useState<CompanyLogoCrop | undefined>();
  const [cropOpen, setCropOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const logoPreviewUrl = useFileUrl(logoUrl);
  const [stampUrl, setStampUrl] = useState<string | undefined>();
  const [stampPosition, setStampPosition] = useState<StampPosition>("bottom-right");
  const [stampWidth, setStampWidth] = useState(140);
  const [stampOpacity, setStampOpacity] = useState(1);
  const [showStamp, setShowStamp] = useState(false);
  const stampPreviewUrl = useFileUrl(stampUrl);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name); setShortName(editing.shortName); setCode(editing.code ?? editing.shortName); setColor(editing.color); setBaseCurrency(editing.baseCurrency);
      setLegalName(editing.legalName ?? ""); setAddress(editing.address ?? "");
      setEmail(editing.email ?? ""); setPhone(editing.phone ?? ""); setWebsite(editing.website ?? "");
      setNif(editing.nif ?? ""); setStat(editing.stat ?? ""); setRcs(editing.rcs ?? ""); setTaxId(editing.taxId ?? "");
      setBankName(editing.bankName ?? ""); setBankAccount(editing.bankAccount ?? ""); setBankSwift(editing.bankSwift ?? "");
      setBankHolder(editing.bankHolder ?? ""); setBankCode(editing.bankCode ?? ""); setBranchCode(editing.branchCode ?? "");
      setAccountNumber(editing.accountNumber ?? ""); setRibKey(editing.ribKey ?? ""); setIban(editing.iban ?? "");
      setIntlEnabled(Boolean(editing.intlEnabled)); setMobileEnabled(Boolean(editing.mobileEnabled));
      setMobileProvider(editing.mobileProvider ?? "MVola"); setMobileNumber(editing.mobileNumber ?? ""); setMobileName(editing.mobileName ?? "");
      setShowPaymentDetails(editing.showPaymentDetails !== false);
      setBankAccounts(companyBankAccounts(editing));
      setLogoUrl(editing.logoUrl);
      setLogoHeight(editing.logoHeight ?? 52);
      setLogoMaxWidth(editing.logoMaxWidth ?? 180);
      setDocLanguage(editing.defaultDocumentLanguage ?? "en");
      setLogoCrop(editing.logoCrop);
      setStampUrl(editing.stampUrl);
      setStampPosition(editing.stampPosition ?? "bottom-right");
      setStampWidth(editing.stampWidth ?? 140);
      setStampOpacity(editing.stampOpacity ?? 1);
      setShowStamp(editing.showStamp === true);
    } else {
      setName(""); setShortName(""); setCode(""); setColor(PALETTE[0]); setBaseCurrency("MGA");
      setLegalName(""); setAddress(""); setEmail(""); setPhone(""); setWebsite("");
      setNif(""); setStat(""); setRcs(""); setTaxId(""); setBankName(""); setBankAccount(""); setBankSwift("");
      setBankHolder(""); setBankCode(""); setBranchCode(""); setAccountNumber(""); setRibKey(""); setIban("");
      setIntlEnabled(false); setMobileEnabled(false); setMobileProvider("MVola"); setMobileNumber(""); setMobileName("");
      setShowPaymentDetails(true);
      setBankAccounts([]);
      setLogoUrl(undefined);
      setLogoHeight(52);
      setLogoMaxWidth(180);
      setLogoCrop(undefined);
      setStampUrl(undefined);
      setStampPosition("bottom-right");
      setStampWidth(140);
      setStampOpacity(1);
      setShowStamp(false);
    }
    setShowErrors(false);
  }, [open, editing]);

  const submit = async () => {
    const invalid = !name.trim() || !shortName.trim();
    if (invalid) {
      setShowErrors(true);
      return;
    }
    const finalCode = (code.trim() || shortName.trim()).toUpperCase();
    const accounts = bankAccounts.map((a, i) => ({ ...a, label: a.label.trim() || `Bank account ${i + 1}` }));
    if (accounts.length > 0 && !accounts.some((a) => a.isDefault)) accounts[0].isDefault = true;
    const def = accounts.find((a) => a.isDefault) ?? accounts[0];
    const local = {
      name, shortName, code: finalCode, color, baseCurrency,
      legalName: legalName || undefined, address: address || undefined,
      email: email || undefined, phone: phone || undefined, website: website || undefined,
      nif: nif || undefined, stat: stat || undefined, rcs: rcs || undefined, taxId: taxId || undefined,
      bankName: def?.bankName, bankAccount: def?.bankAccount, bankSwift: def?.bankSwift,
      bankHolder: def?.bankHolder, bankCode: def?.bankCode, branchCode: def?.branchCode,
      accountNumber: def?.accountNumber, ribKey: def?.ribKey, iban: def?.iban,
      intlEnabled: Boolean(def?.intlEnabled), mobileEnabled: Boolean(def?.mobileEnabled),
      mobileProvider: def?.mobileProvider, mobileNumber: def?.mobileNumber, mobileName: def?.mobileName,
      showPaymentDetails, bankAccounts: accounts,
      logoUrl, logoHeight, logoMaxWidth, logoCrop,
      stampUrl, stampPosition, stampWidth, stampOpacity, showStamp,
      defaultDocumentLanguage: docLanguage,
    };
    const dbRow = {
      name, code: finalCode, short_name: shortName, color, base_currency: baseCurrency,
      legal_name: legalName || null, address: address || null,
      email: email || null, phone: phone || null, website: website || null,
      nif: nif || null, stat: stat || null, rcs: rcs || null, tax_id: taxId || null,
      bank_name: def?.bankName ?? null, bank_account: def?.bankAccount ?? null, bank_swift: def?.bankSwift ?? null,
      bank_holder: def?.bankHolder ?? null, bank_code: def?.bankCode ?? null, branch_code: def?.branchCode ?? null,
      account_number: def?.accountNumber ?? null, rib_key: def?.ribKey ?? null, iban: def?.iban ?? null,
      intl_enabled: Boolean(def?.intlEnabled), mobile_enabled: Boolean(def?.mobileEnabled),
      mobile_provider: def?.mobileEnabled ? def?.mobileProvider ?? null : null,
      mobile_number: def?.mobileNumber ?? null, mobile_name: def?.mobileName ?? null,
      show_payment_details: showPaymentDetails,
      bank_accounts: accounts as unknown as never,
      logo_url: logoUrl || null,
      logo_height: logoHeight,
      logo_max_width: logoMaxWidth,
      logo_crop: (logoCrop ?? null) as unknown as never,
      stamp_url: stampUrl || null,
      stamp_position: stampPosition,
      stamp_width: stampWidth,
      stamp_opacity: stampOpacity,
      show_stamp: showStamp,
      default_document_language: docLanguage,
    };
    if (editing) {
      const stampChanged =
        editing.stampUrl !== stampUrl || editing.stampWidth !== stampWidth ||
        editing.stampOpacity !== stampOpacity || editing.stampPosition !== stampPosition ||
        editing.showStamp !== showStamp;
      companiesStore.update(editing.id, local);
      // Match the DB row by code (the local id may be a mock seed id like "log").
      await supabase.from("companies").update(dbRow).eq("code", finalCode);
      // Existing documents now carry an outdated stamp — flag them for refresh.
      if (stampChanged) await markCompanyDocumentsDirty(editing.id);
    } else {
      const { data } = await supabase.from("companies").insert(dbRow).select("id").single();
      const id = data?.id ?? newId("co");
      companiesStore.add({ id, ...local });
    }
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit company" : "New company"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <FormErrorBanner show={showErrors} />
          <div className="flex items-start gap-4">
            <div>
              <Label>Logo</Label>
              <div className="mt-2"><AvatarUpload value={logoUrl} onChange={(v) => { setLogoUrl(v); setLogoCrop(undefined); }} name={name || "Logo"} size={72} square /></div>
              <p className="text-[10px] text-muted-foreground mt-1">Shown on invoice / PO / quote PDFs.</p>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-3"><Label><RequiredLabel>Trading name</RequiredLabel></Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Logia Madagascar" className={invalidFieldClassName(showErrors && !name.trim())} aria-invalid={showErrors && !name.trim()} /></div>
              <div><Label><RequiredLabel>Short name</RequiredLabel></Label><Input value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 4))} placeholder="LOG" className={invalidFieldClassName(showErrors && !shortName.trim())} aria-invalid={showErrors && !shortName.trim()} /></div>
              <div>
                <Label>Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder={shortName || "LOG"} />
                <p className="text-[10px] text-muted-foreground mt-1">Used as a compact tag across the app.</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Logo on documents</Label>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" disabled={!logoUrl} onClick={() => setCropOpen(true)}>Adjust logo</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { if (logoCrop?.sourceRef) setLogoUrl(logoCrop.sourceRef); setLogoCrop(undefined); setLogoHeight(52); setLogoMaxWidth(180); }}
                >
                  Reset
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Height</span><span className="tabular-nums">{logoHeight}px</span></div>
                <Slider value={[logoHeight]} min={24} max={140} step={1} onValueChange={([v]) => setLogoHeight(v)} className="mt-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Max width</span><span className="tabular-nums">{logoMaxWidth}px</span></div>
                <Slider value={[logoMaxWidth]} min={80} max={360} step={2} onValueChange={([v]) => setLogoMaxWidth(v)} className="mt-2" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">Document language</div>
                <div className="flex rounded-md border border-border overflow-hidden w-fit">
                  {(["en", "fr"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setDocLanguage(l)}
                      className={`px-3 py-1 text-xs transition ${docLanguage === l ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {l === "en" ? "English" : "Français"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-md bg-white border border-border p-3">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Logo preview" style={{ maxHeight: logoHeight, maxWidth: logoMaxWidth, objectFit: "contain" }} />
              ) : (
                <p className="text-[11px] text-neutral-500">Upload a logo to preview how it prints.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Stamp on documents</Label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <Checkbox checked={showStamp} onCheckedChange={(v) => setShowStamp(!!v)} />
                Print the stamp
              </label>
            </div>
            <div className="flex items-start gap-4">
              <div>
                <AvatarUpload value={stampUrl} onChange={setStampUrl} name="Stamp" size={72} square folder="stamps" mark keyOutWhite />
                <p className="text-[10px] text-muted-foreground mt-1 max-w-[120px]">PNG with a transparent background works best.</p>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Position</div>
                  <div className="flex rounded-md border border-border overflow-hidden w-fit">
                    {([["bottom-right", "Bottom right"], ["bottom-left", "Bottom left"], ["center", "Centered"]] as const).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setStampPosition(v)}
                        className={`px-3 py-1 text-xs transition ${stampPosition === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Width</span><span className="tabular-nums">{stampWidth}px</span></div>
                    <Slider value={[stampWidth]} min={60} max={280} step={2} onValueChange={([v]) => setStampWidth(v)} className="mt-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Opacity</span><span className="tabular-nums">{Math.round(stampOpacity * 100)}%</span></div>
                    <Slider value={[Math.round(stampOpacity * 100)]} min={20} max={100} step={5} onValueChange={([v]) => setStampOpacity(v / 100)} className="mt-2" />
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-md bg-white border border-border p-3 grid place-items-center min-h-[80px]">
              {stampPreviewUrl ? (
                <img src={stampPreviewUrl} alt="Stamp preview" style={{ width: stampWidth, opacity: stampOpacity, objectFit: "contain" }} />
              ) : (
                <p className="text-[11px] text-neutral-500">Upload a stamp to preview how it prints.</p>
              )}
            </div>
          </div>
          <LogoCropDialog
            open={cropOpen}
            onOpenChange={setCropOpen}
            value={logoUrl}
            crop={logoCrop}
            aspect={logoMaxWidth / Math.max(1, logoHeight)}
            onApply={(ref, c) => { setLogoUrl(ref); setLogoCrop(c); }}
          />
          <div><Label>Legal name (on invoices)</Label><Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="LOGIA SARL" /></div>
          <div><Label>Registered address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Lot II M 73 ter Antananarivo 101" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@logia.mg" /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+261 20 22 000 00" /></div>
          </div>
          <div><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://logia.mg" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>NIF</Label><Input value={nif} onChange={(e) => setNif(e.target.value)} /></div>
            <div><Label>STAT</Label><Input value={stat} onChange={(e) => setStat(e.target.value)} /></div>
            <div><Label>RCS</Label><Input value={rcs} onChange={(e) => setRcs(e.target.value)} /></div>
          </div>
          <div><Label>Tax / VAT ID (intl.)</Label><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bank accounts</div>
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <Checkbox checked={showPaymentDetails} onCheckedChange={(v) => setShowPaymentDetails(!!v)} />
                Show on documents
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Add every bank account of this company. The default one is preselected on new invoices, quotes and POs — each document can override it.
            </p>
            <BankAccountsEditor value={bankAccounts} onChange={setBankAccounts} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Base currency</Label>
              <Select value={baseCurrency} onValueChange={(v) => setBaseCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MGA">MGA — Ariary</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="USD">USD — Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Color</Label>
              <div className="space-y-2 mt-2">
                <div className="grid grid-cols-8 gap-2">
                  {PALETTE.slice(0, 16).map((p) => (
                    <button key={p} type="button" onClick={() => setColor(p)} className={`h-7 w-7 rounded-md border-2 transition ${color === p ? "border-foreground" : "border-transparent"}`} style={{ background: p }} />
                  ))}
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {PALETTE.slice(16).map((p) => (
                    <button key={p} type="button" onClick={() => setColor(p)} className={`h-7 w-7 rounded-md border-2 transition ${color === p ? "border-foreground" : "border-transparent"}`} style={{ background: p }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className={`font-tnum font-medium ${accent ? "text-primary font-display" : ""}`}>{value}</span>
    </div>
  );
}
