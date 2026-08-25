import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useCompanies, useAccounts, useTransactions, useProjects, useClients, useInvoices,
  companiesStore, toMGA, fmtCompact, type Company, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, ChevronRight } from "lucide-react";
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
import { useAuth } from "@/lib/auth-context";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { KpiCard } from "@/components/kpi-card";
import { useColumnPrefs, type ColumnDef } from "@/lib/column-prefs";
import { MasterDetail, DetailPanel, DetailSection, DetailField } from "@/components/master-detail";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";


export const Route = createFileRoute("/_authenticated/companies")({ component: CompaniesPage });

const COMPANY_COLUMNS: ColumnDef[] = [
  { key: "code", label: "Code" },
  { key: "currency", label: "Base currency" },
  { key: "cash", label: "Cash" },
  { key: "income", label: "Income" },
  { key: "spend", label: "Spend" },
  { key: "net", label: "Net" },
  { key: "accounts", label: "Accounts", priority: "optional" },
  { key: "projects", label: "Projects", priority: "optional" },
  { key: "clients", label: "Clients", priority: "optional" },
];


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
  const projects = useProjects();
  const clients = useClients();
  const invoices = useInvoices();
  const { user, profile } = useAuth();
  const { isSalesOnly: salesOnly } = useEffectiveRole();
  const [editing, setEditing] = useState<Company | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Company) => { setEditing(c); setOpen(true); };
  const remove = async (c: Company) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    companiesStore.remove(c.id);
    await supabase.from("companies").delete().eq("code", (c.code || c.shortName || "").toUpperCase());
    setSelectedId((id) => (id === c.id ? null : id));
  };

  /**
   * Records that belong to the signed-in sales rep. Sales users see personal
   * figures on this page, never the entity totals: their clients (they brought
   * them in), the invoices they created or are assigned to, and the projects of
   * their clients.
   */
  const owned = useMemo(() => {
    const myId = user?.id ?? "";
    const myName = (profile?.display_name ?? "").trim().toLowerCase();
    const mine = (name?: string) => !!myName && (name ?? "").trim().toLowerCase() === myName;
    const clientIds = new Set(clients.filter((c) => mine(c.acquisition)).map((c) => c.id));
    const inv = invoices.filter(
      (i) => (myId && i.createdBy === myId) || (i.assignedTo ?? []).includes(myId) || (i.clientId ? clientIds.has(i.clientId) : false),
    );
    inv.forEach((i) => { if (i.clientId) clientIds.add(i.clientId); });
    const proj = projects.filter((p) => clientIds.has(p.clientId));
    return { clientIds, invoices: inv, projects: proj, projectIds: new Set(proj.map((p) => p.id)) };
  }, [user?.id, profile?.display_name, clients, invoices, projects]);

  /** Per-company figures, sales-scoped when the viewer is a sales rep. */
  const statsOf = (c: Company) => {
    const cAcc = accounts.filter((a) => a.companyId === c.id);
    if (salesOnly) {
      const inv = owned.invoices.filter((i) => i.companyId === c.id);
      const proj = owned.projects.filter((p) => p.companyId === c.id);
      const projectIds = new Set(proj.map((p) => p.id));
      const income = inv.reduce((s, i) => s + toMGA(i.paid, i.currency), 0);
      const spend = transactions
        .filter((t) => t.companyId === c.id && t.type === "expense" && t.projectId && projectIds.has(t.projectId))
        .reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
      const clientCount = new Set(
        clients.filter((cl) => cl.companyId === c.id && owned.clientIds.has(cl.id)).map((cl) => cl.id),
      ).size;
      return { cash: 0, income, spend, net: income - spend, accounts: cAcc.length, projects: proj.length, clients: clientCount };
    }
    const cTx = transactions.filter((t) => t.companyId === c.id);
    const cash = cAcc.reduce((s, a) => s + toMGA(a.balance, a.currency), 0);
    const income = cTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
    const spend = cTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
    return {
      cash, income, spend, net: income - spend,
      accounts: cAcc.length,
      projects: projects.filter((p) => p.companyId === c.id).length,
      clients: clients.filter((cl) => cl.companyId === c.id).length,
    };
  };

  const fields: FieldDef<Company>[] = [
    { key: "name", label: "Company", type: "string", accessor: (c) => c.name, noGroup: true },
    { key: "code", label: "Code", type: "enum", accessor: (c) => c.code ?? c.shortName },
    { key: "currency", label: "Base currency", type: "enum", accessor: (c) => c.baseCurrency },
    { key: "income", label: "Income", type: "number", accessor: (c) => statsOf(c).income, noGroup: true },
    { key: "net", label: "Net", type: "number", accessor: (c) => statsOf(c).net, noGroup: true },
  ];
  const view = useDataView<Company>("companies", fields);
  const groups = view.apply(companies);
  const list = groups.flatMap((g) => g.items);
  const cp = useColumnPrefs("companies", COMPANY_COLUMNS);
  const hiddenForSales = salesOnly ? ["cash", "accounts"] : [];
  const shown = (key: string) => !hiddenForSales.includes(key) && cp.on(key);
  const colCount = 2 + COMPANY_COLUMNS.filter((c) => shown(c.key)).length;
  const yours = salesOnly ? " (yours)" : "";

  const kpi = useMemo(() => {
    let cash = 0, income = 0, spend = 0;
    for (const c of list) {
      const s = statsOf(c);
      cash += s.cash; income += s.income; spend += s.spend;
    }
    return { cash, income, spend, net: income - spend, count: list.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, accounts, transactions, projects, clients, invoices, salesOnly, owned]);

  const selected = selectedId ? list.find((c) => c.id === selectedId) ?? null : null;
  const detail = selected ? (() => {
    const s = statsOf(selected);
    return (
      <DetailPanel
        eyebrow={selected.code ?? selected.shortName}
        title={selected.name}
        subtitle={selected.legalName}
        onClose={() => setSelectedId(null)}
        actions={
          <Button size="sm" onClick={() => openEdit(selected)} className="gap-1.5">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        }
      >
        <DetailSection title="Identity">
          <DetailField label="Short name" value={selected.shortName} />
          <DetailField label="Code" value={selected.code ?? selected.shortName} />
          <DetailField label="Base currency" value={selected.baseCurrency} mono />
        </DetailSection>
        <DetailSection title="Contact">
          <DetailField label="Email" value={selected.email} />
          <DetailField label="Phone" value={selected.phone} />
          <DetailField label="Website" value={selected.website} />
          <DetailField label="Address" value={selected.address} />
        </DetailSection>
        <DetailSection title="Legal IDs">
          <DetailField label="NIF" value={selected.nif} mono />
          <DetailField label="STAT" value={selected.stat} mono />
          <DetailField label="RCS" value={selected.rcs} mono />
          <DetailField label="Tax ID" value={selected.taxId} mono />
        </DetailSection>
        <DetailSection title={salesOnly ? "Your figures" : "Financials"}>
          {!salesOnly && <DetailField label="Cash" value={fmtCompact(s.cash, "MGA")} mono />}
          <DetailField label="Income" value={fmtCompact(s.income, "MGA")} mono />
          <DetailField label="Spend" value={fmtCompact(s.spend, "MGA")} mono />
          <DetailField label="Net" value={fmtCompact(s.net, "MGA")} mono />
          {!salesOnly && <DetailField label="Accounts" value={String(s.accounts)} mono />}
          <DetailField label="Projects" value={String(s.projects)} mono />
          <DetailField label="Clients" value={String(s.clients)} mono />
        </DetailSection>
      </DetailPanel>
    );
  })() : null;

  return (
    <AppShell>
      <PageHeader title="Companies" description="Group entities under your control." />
      <div className="p-5 sm:p-10 lg:p-12">
        <MasterDetail detail={detail}>
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CrudToolbar createLabel="New company" count={list.length} label="companies" onCreate={openCreate} />
              <div className="flex items-center gap-2 flex-wrap">
                <ColumnPicker prefs={cp} />
                <DataToolbar view={view} items={companies} />
              </div>
            </div>

            {list.length === 0 ? (
              <EmptyState label="companies" onCreate={openCreate} />
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {!salesOnly && <KpiCard label="Cash" value={fmtCompact(kpi.cash, "MGA")} />}
                  <KpiCard label={`Income${yours}`} value={fmtCompact(kpi.income, "MGA")} tone="success" />
                  <KpiCard label={`Spend${yours}`} value={fmtCompact(kpi.spend, "MGA")} tone="danger" />
                  <KpiCard label={`Net${yours}`} value={fmtCompact(kpi.net, "MGA")} tone={kpi.net >= 0 ? "success" : "danger"} />
                  <KpiCard label="Entities" value={String(kpi.count)} />
                </div>

                <ListTableShell>
                  <ListTable>
                    <thead>
                      <ListHeadRow>
                        <ListActionsTh />
                        <ListTh width="26%">Company</ListTh>
                        {shown("code") && <ListTh width="9%">Code</ListTh>}
                        {shown("currency") && <ListTh width="9%">Base</ListTh>}
                        {shown("cash") && <ListTh width="12%" align="right">Cash</ListTh>}
                        {shown("income") && <ListTh width="12%" align="right">{`Income${yours}`}</ListTh>}
                        {shown("spend") && <ListTh width="12%" align="right">{`Spend${yours}`}</ListTh>}
                        {shown("net") && <ListTh width="12%" align="right">{`Net${yours}`}</ListTh>}
                        {shown("accounts") && <ListTh width="8%" align="right">Accounts</ListTh>}
                        {shown("projects") && <ListTh width="8%" align="right">Projects</ListTh>}
                        {shown("clients") && <ListTh width="8%" align="right">Clients</ListTh>}
                      </ListHeadRow>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <Fragment key={g.key}>
                          {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={colCount} />}
                          {g.items.map((c) => {
                            const s = statsOf(c);
                            return (
                              <tr
                                key={c.id}
                                data-selected={selectedId === c.id ? "true" : undefined}
                                className="hover:bg-surface-elevated/40 data-[selected=true]:bg-[var(--primary-container)]/40 cursor-pointer transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
                                onClick={() => setSelectedId(c.id)}
                              >
                                <ListRowActions colSpan={colCount}>
                                  <RowAction icon={<ChevronRight className="h-3.5 w-3.5" />} label="Details" onClick={() => setSelectedId(c.id)} />
                                  <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => openEdit(c)} />
                                  <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" tone="danger" onClick={() => void remove(c)} />
                                </ListRowActions>
                                <ListTd className="font-medium" title={c.name}>
                                  <span className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="h-6 w-6 shrink-0 rounded-md grid place-items-center text-[10px] font-display font-bold text-primary-foreground"
                                      style={{ background: c.color }}
                                    >
                                      {c.shortName}
                                    </span>
                                    <span className="truncate">{c.name}</span>
                                  </span>
                                </ListTd>
                                {shown("code") && <ListTd className="text-muted-foreground">{c.code ?? c.shortName}</ListTd>}
                                {shown("currency") && <ListTd className="text-muted-foreground">{c.baseCurrency}</ListTd>}
                                {shown("cash") && <ListTd align="right" className="font-tnum">{fmtCompact(s.cash, "MGA")}</ListTd>}
                                {shown("income") && <ListTd align="right" className="font-tnum">{fmtCompact(s.income, "MGA")}</ListTd>}
                                {shown("spend") && <ListTd align="right" className="font-tnum">{fmtCompact(s.spend, "MGA")}</ListTd>}
                                {shown("net") && <ListTd align="right" className="font-tnum">{fmtCompact(s.net, "MGA")}</ListTd>}
                                {shown("accounts") && <ListTd align="right" className="font-tnum">{s.accounts}</ListTd>}
                                {shown("projects") && <ListTd align="right" className="font-tnum">{s.projects}</ListTd>}
                                {shown("clients") && <ListTd align="right" className="font-tnum">{s.clients}</ListTd>}
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </ListTable>
                </ListTableShell>
              </>
            )}
          </div>
        </MasterDetail>
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
