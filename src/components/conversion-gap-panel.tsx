/**
 * Conversion gap panel — how much revenue is sitting between
 * "quotation created" and "invoice issued", broken down per client and project.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  useQuotes, useInvoices, useClients, useProjects, fmtCompact,
  type Quote, type Invoice,
} from "@/lib/mock-data";
import { inScope, useCompany } from "@/lib/company-context";
import {
  buildConversionGap, gapByClient, gapByProject, gapTotal, type GapRow,
} from "@/lib/conversion-gap";
import { KpiCard } from "@/components/kpi-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const money = (n: number) => fmtCompact(n, "MGA");

function DocList({ quotes, invoices }: { quotes: Quote[]; invoices: Invoice[] }) {
  if (!quotes.length && !invoices.length) return null;
  return (
    <ul className="mt-2 space-y-1 t-label text-muted-foreground">
      {quotes.map((q) => (
        <li key={q.id}>
          <Link to="/quotations" search={{ focus: q.id }} className="hover:underline">
            {q.number} · {q.subject || "Quotation"} · {q.status}
          </Link>
        </li>
      ))}
      {invoices.map((i) => (
        <li key={i.id}>
          <Link to="/invoices" search={{ focus: i.id }} className="hover:underline">
            {i.number} · draft invoice
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GapTable({ rows, unit }: { rows: GapRow[]; unit: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) {
    return <p className="t-body text-muted-foreground py-6">Nothing waiting — every quotation is invoiced.</p>;
  }
  return (
    <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1.6fr_repeat(4,1fr)] gap-2 px-3 py-2 t-label uppercase tracking-wide text-muted-foreground bg-muted/40">
        <span>{unit}</span>
        <span className="text-right">Not sent</span>
        <span className="text-right">Awaiting invoicing</span>
        <span className="text-right">Draft invoices</span>
        <span className="text-right">Total at risk</span>
      </div>
      {rows.map((r) => {
        const expanded = open === r.key;
        return (
          <div key={r.key}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : r.key)}
              aria-expanded={expanded}
              className="w-full grid grid-cols-2 sm:grid-cols-[1.6fr_repeat(4,1fr)] gap-2 px-3 py-2 t-body text-left hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium truncate">
                {expanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="text-right tabular-nums">
                {r.notSent.count ? `${r.notSent.count} · ${money(r.notSent.amount)}` : "—"}
              </span>
              <span className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                {r.awaitingInvoicing.count ? `${r.awaitingInvoicing.count} · ${money(r.awaitingInvoicing.amount)}` : "—"}
              </span>
              <span className="text-right tabular-nums">
                {r.draftInvoices.count ? `${r.draftInvoices.count} · ${money(r.draftInvoices.amount)}` : "—"}
              </span>
              <span className="text-right tabular-nums font-semibold">{money(r.total)}</span>
            </button>
            {expanded && (
              <div className="px-3 pb-3 pl-8 bg-muted/20">
                <DocList
                  quotes={[...r.quotesNotSent, ...r.quotesAwaiting]}
                  invoices={r.invoicesDraft}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ConversionGapPanel({ className }: { className?: string }) {
  const { scope } = useCompany();
  const quotes = inScope(useQuotes(), scope);
  const invoices = inScope(useInvoices(), scope);
  const clients = useClients();
  const projects = useProjects();

  const gap = useMemo(() => buildConversionGap(quotes, invoices), [quotes, invoices]);
  const byClient = useMemo(() => gapByClient(quotes, invoices, clients), [quotes, invoices, clients]);
  const byProject = useMemo(() => gapByProject(quotes, invoices, projects), [quotes, invoices, projects]);
  const total = gapTotal(gap);

  return (
    <section className={cn("space-y-4", className)} aria-label="Conversion gap">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="t-subtitle font-semibold">Quotation → invoice conversion</h2>
          <p className="t-body text-muted-foreground">
            Revenue that exists on paper but has not been billed yet.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/quotations">Open quotations</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Created, not sent" value={`${gap.notSent.count}`} sub={money(gap.notSent.amount)} />
        <KpiCard
          label="Accepted, not invoiced"
          value={`${gap.awaitingInvoicing.count}`}
          sub={money(gap.awaitingInvoicing.amount)}
          tone={gap.awaitingInvoicing.count ? "warning" : "default"}
        />
        <KpiCard label="Invoices in draft" value={`${gap.draftInvoices.count}`} sub={money(gap.draftInvoices.amount)} />
        <KpiCard label="Total at risk" value={money(total)} sub="Across all three stages" highlight />
      </div>

      <Tabs defaultValue="client">
        <TabsList>
          <TabsTrigger value="client">By client</TabsTrigger>
          <TabsTrigger value="project">By project</TabsTrigger>
        </TabsList>
        <TabsContent value="client" className="mt-3">
          <GapTable rows={byClient} unit="Client" />
        </TabsContent>
        <TabsContent value="project" className="mt-3">
          <GapTable rows={byProject} unit="Project" />
        </TabsContent>
      </Tabs>
    </section>
  );
}
