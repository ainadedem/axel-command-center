import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportCsvRows } from "@/lib/export-csv";
import {
  useCompanies,
  useAccounts,
  useClients,
  useSuppliers,
  useProjects,
  useTransactions,
  useInvoices,
  useOpportunities,
  useCategories,
  useBudgets,
  useTeamMembers,
  useSalesMembers,
  useQuotes,
  useQuoteFollowups,
  usePurchaseOrders,
  useExpenses,
  useRecurringBillings,
  useSalaryRegister,
  usePayrollRuns,
  usePvrRecords,
  useInvoiceEscalations,
} from "@/lib/mock-data";

type Row = Record<string, unknown>;

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** Union of keys across the dataset, in first-seen order. */
function keysOf(rows: Row[]): string[] {
  const keys: string[] = [];
  for (const row of rows) for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k);
  return keys;
}

const stamp = () => new Date().toISOString().slice(0, 10);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DataExportCard() {
  const [busy, setBusy] = useState(false);

  const ds = (name: string, rows: readonly unknown[]) => ({ name, rows: rows as Row[] });

  const datasets: { name: string; rows: Row[] }[] = [
    ds("companies", useCompanies()),
    ds("accounts", useAccounts()),
    ds("clients", useClients()),
    ds("suppliers", useSuppliers()),
    ds("projects", useProjects()),
    ds("transactions", useTransactions()),
    ds("invoices", useInvoices()),
    ds("quotations", useQuotes()),
    ds("quotation-followups", useQuoteFollowups()),
    ds("purchase-orders", usePurchaseOrders()),
    ds("expenses", useExpenses()),
    ds("recurring-billings", useRecurringBillings()),
    ds("opportunities", useOpportunities()),
    ds("categories", useCategories()),
    ds("budgets", useBudgets()),
    ds("team-members", useTeamMembers()),
    ds("sales-members", useSalesMembers()),
    ds("salary-register", useSalaryRegister()),
    ds("payroll-runs", usePayrollRuns()),
    ds("pvr-records", usePvrRecords()),
    ds("invoice-escalations", useInvoiceEscalations()),
  ];

  const nonEmpty = datasets.filter((d) => d.rows.length > 0);
  const total = nonEmpty.reduce((s, d) => s + d.rows.length, 0);

  const downloadSeparate = async () => {
    setBusy(true);
    const t = toast.loading("Preparing CSV files…");
    try {
      for (const d of nonEmpty) {
        const keys = keysOf(d.rows);
        exportCsvRows(
          `axel-${d.name}-${stamp()}.csv`,
          keys,
          d.rows.map((r) => keys.map((k) => cell(r[k]))),
        );
        // Browsers drop rapid-fire downloads; give each one a beat.
        await wait(220);
      }
      toast.success(`Downloaded ${nonEmpty.length} CSV files (${total} rows)`, { id: t });
    } catch (e) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : String(e)}`, { id: t });
    } finally {
      setBusy(false);
    }
  };

  const downloadCombined = () => {
    const headers = ["dataset", "field", "value", "record"];
    const rows: string[][] = [];
    for (const d of nonEmpty) {
      const keys = keysOf(d.rows);
      d.rows.forEach((r, i) => {
        for (const k of keys) rows.push([d.name, k, cell(r[k]), String(i + 1)]);
      });
    }
    exportCsvRows(`axel-all-data-${stamp()}.csv`, headers, rows);
    toast.success(`Exported ${total} records into a single CSV`);
  };

  return (
    <section className="rounded-xl border border-border bg-[var(--gradient-surface)] p-6">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Data export</div>
      <p className="text-caption text-muted-foreground mt-1">
        Download everything you can access — {nonEmpty.length} datasets, {total.toLocaleString()} records — as CSV.
        Exports reflect your current company access and permissions.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5" disabled={busy || total === 0} onClick={() => void downloadSeparate()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          One CSV per dataset
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={busy || total === 0}
          onClick={downloadCombined}
        >
          <Download className="h-4 w-4" /> Single combined CSV
        </Button>
      </div>
    </section>
  );
}
