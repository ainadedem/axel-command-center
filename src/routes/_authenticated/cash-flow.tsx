import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ProjectsStylePageShell, RecordCountChip } from "@/components/projects-style-page-shell";
import {
  ListTableShell, ListTable, ListHeadRow, ListTh, ListTd,
} from "@/components/list-table";
import { Input } from "@/components/ui/input";
import {
  ChartFrame, ChartTooltip, chartGridProps, chartAxisProps, chartMargin, chartCursor, chartBarProps,
} from "@/components/charts";
import { inScope, useCompany } from "@/lib/company-context";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { useInvoices, useTransactions, useClients, usePaymentRequests, fmtCompact, fmt } from "@/lib/mock-data";
import { clientLabel } from "@/lib/client-name";
import {
  cashFlowRows, cashFlowTotals, cashFlowByMonthWithOutflow, outflowRows, outflowTotals,
  type CashFlowRow,
} from "@/lib/cash-flow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cash-flow")({
  component: CashFlowPage,
});

const STATE_LABEL: Record<CashFlowRow["state"], string> = {
  paid: "Paid",
  partial: "Partly paid",
  overdue: "Overdue",
  open: "Open",
  cancelled: "Cancelled",
};

const STATE_TONE: Record<CashFlowRow["state"], string> = {
  paid: "bg-success/12 text-success",
  partial: "bg-primary/12 text-primary",
  overdue: "bg-destructive/12 text-destructive",
  open: "bg-surface text-muted-foreground",
  cancelled: "bg-surface text-muted-foreground/70",
};

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
};

function CashFlowPage() {
  return (
    <AppShell>
      <PageHeader
        title="Cash flow"
        description="Every invoice, what has been collected, and what is still owed — with monthly totals."
      />
      <CashFlowBody />
    </AppShell>
  );
}

function CashFlowBody() {
  const { scope } = useCompany();
  const { canSeeFinance, roleResolved } = useEffectiveRole();
  const invoices = useInvoices();
  const transactions = useTransactions();
  const clients = useClients();
  const paymentRequests = usePaymentRequests();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"all" | CashFlowRow["state"]>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => cashFlowRows(inScope(invoices, scope), inScope(transactions, scope)),
    [invoices, transactions, scope],
  );
  const outflows = useMemo(
    () => outflowRows(inScope(paymentRequests, scope)),
    [paymentRequests, scope],
  );
  const months = useMemo(() => cashFlowByMonthWithOutflow(rows, outflows), [rows, outflows]);
  const totals = useMemo(() => cashFlowTotals(rows), [rows]);
  const out = useMemo(() => outflowTotals(outflows), [outflows]);

  const clientName = (id: string) => clientLabel(clients.find((c) => c.id === id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (state !== "all" && r.state !== state) return false;
      if (!q) return true;
      return (
        r.invoice.number.toLowerCase().includes(q) ||
        clientName(r.invoice.clientId).toLowerCase().includes(q)
      );
    });
  }, [rows, query, state, clients]);

  if (roleResolved && !canSeeFinance) {
    return (
      <div className="p-8 t-body text-muted-foreground">
        Cash flow figures are only visible to finance and administrator roles.
      </div>
    );
  }

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <ProjectsStylePageShell
      kpis={
        <>
          <KpiCard label="Invoiced" value={fmtCompact(totals.invoicedMGA, "MGA")} sub="All open periods" />
          <KpiCard label="Collected" value={fmtCompact(totals.collectedMGA, "MGA")} tone="success" sub="Money received" />
          <KpiCard label="Outstanding" value={fmtCompact(totals.outstandingMGA, "MGA")} sub="Still owed" />
          <KpiCard label="Paid out" value={fmtCompact(out.paidOutMGA, "MGA")} sub="Approved payments released" />
          <KpiCard
            label="Net cash"
            value={fmtCompact(totals.collectedMGA - out.paidOutMGA, "MGA")}
            tone={totals.collectedMGA - out.paidOutMGA >= 0 ? "success" : "danger"}
            sub={out.committedMGA > 0 ? `${fmtCompact(out.committedMGA, "MGA")} approved, not yet paid` : "Collected minus paid out"}
          />
          <KpiCard label="Overdue" value={fmtCompact(totals.overdueMGA, "MGA")} tone="danger" sub="Past the due date" />
        </>
      }
      toolbar={
        <>
          <div className="relative min-w-[12rem] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoice or client"
              className="h-8 pl-8 t-label"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(["all", "open", "partial", "overdue", "paid"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setState(s)}
                className={cn(
                  "h-8 rounded-full px-3 t-label transition-colors",
                  state === s ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? "All" : STATE_LABEL[s]}
              </button>
            ))}
          </div>
          <RecordCountChip count={filtered.length} total={rows.length} label="invoices" filtered={filtered.length !== rows.length} />
        </>
      }
      beforeToolbar={
        months.length > 0 ? (
          <ChartFrame
            title="Monthly cash flow"
            description="Invoiced vs collected, in MGA"
            series={[
              { key: "invoicedMGA", label: "Invoiced", color: "var(--primary)" },
              { key: "collectedMGA", label: "Collected", color: "var(--success)" },
              { key: "paidOutMGA", label: "Paid out", color: "var(--destructive)" },
            ]}
            data={months as unknown as Array<Record<string, unknown>>}
            labelKey="month"
            formatValue={(v) => fmtCompact(v, "MGA")}
            height={220}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={months} margin={chartMargin}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="month" tickFormatter={monthLabel} {...chartAxisProps} />
                <YAxis tickFormatter={(v: number) => fmtCompact(v, "MGA")} {...chartAxisProps} />
                <Tooltip
                  cursor={chartCursor}
                  content={<ChartTooltip formatter={(v: number) => fmtCompact(v, "MGA")} />}
                />
                <Bar dataKey="invoicedMGA" name="Invoiced" fill="var(--primary)" {...chartBarProps} />
                <Bar dataKey="collectedMGA" name="Collected" fill="var(--success)" {...chartBarProps} />
                <Bar dataKey="paidOutMGA" name="Paid out" fill="var(--destructive)" {...chartBarProps} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        ) : null
      }
      afterToolbar={
        months.length > 0 ? (
          <ListTableShell>
            <ListTable>
              <thead>
                <ListHeadRow>
                  <ListTh width="34%">Month</ListTh>
                  <ListTh align="right">Invoiced</ListTh>
                  <ListTh align="right">Collected</ListTh>
                  <ListTh align="right">Outstanding</ListTh>
                  <ListTh align="right">Paid out</ListTh>
                  <ListTh align="right">Net</ListTh>
                  <ListTh align="right">Running</ListTh>
                </ListHeadRow>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="border-b border-border/40 last:border-0">
                    <ListTd>{monthLabel(m.month)}</ListTd>
                    <ListTd align="right">{fmtCompact(m.invoicedMGA, "MGA")}</ListTd>
                    <ListTd align="right" className="text-success">{fmtCompact(m.collectedMGA, "MGA")}</ListTd>
                    <ListTd align="right">{fmtCompact(m.outstandingMGA, "MGA")}</ListTd>
                    <ListTd align="right" className={m.paidOutMGA > 0 ? "text-destructive" : undefined}>
                      {m.paidOutMGA > 0 ? fmtCompact(m.paidOutMGA, "MGA") : "—"}
                    </ListTd>
                    <ListTd align="right" className={m.netMGA < 0 ? "text-destructive" : "text-success"}>
                      {fmtCompact(m.netMGA, "MGA")}
                    </ListTd>
                    <ListTd align="right" className={m.runningMGA < 0 ? "text-destructive" : undefined}>
                      {fmtCompact(m.runningMGA, "MGA")}
                    </ListTd>
                  </tr>
                ))}
              </tbody>
            </ListTable>
          </ListTableShell>
        ) : null
      }
    >
      <ListTableShell scrollX stickyHeader>
        <ListTable>
          <thead>
            <ListHeadRow>
              <ListTh width="2.25rem" />
              <ListTh width="12%">Invoice</ListTh>
              <ListTh width="20%">Client</ListTh>
              <ListTh width="9%">Issued</ListTh>
              <ListTh width="9%">Due</ListTh>
              <ListTh width="11%" align="right">Amount</ListTh>
              <ListTh width="11%" align="right">Paid</ListTh>
              <ListTh width="9%">Paid on</ListTh>
              <ListTh width="11%" align="right">Balance</ListTh>
              <ListTh width="10%">Status</ListTh>
            </ListHeadRow>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const expanded = open.has(r.invoice.id);
              return (
                <Fragment key={r.invoice.id}>
                  <tr className="border-b border-border/40 hover:bg-surface-elevated/40 transition-colors">
                    <ListTd>
                      <button
                        type="button"
                        aria-label={expanded ? "Hide payments" : "Show payments"}
                        onClick={() => toggle(r.invoice.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    </ListTd>
                    <ListTd title={r.invoice.number}>{r.invoice.number}</ListTd>
                    <ListTd title={clientName(r.invoice.clientId)}>{clientName(r.invoice.clientId)}</ListTd>
                    <ListTd>{r.invoice.issueDate}</ListTd>
                    <ListTd title={r.daysLate ? `${r.daysLate} days late` : undefined}>{r.invoice.dueDate}</ListTd>
                    <ListTd align="right">{fmt(r.invoiced, r.invoice.currency)}</ListTd>
                    <ListTd align="right">{fmt(r.paid, r.invoice.currency)}</ListTd>
                    <ListTd>{r.paidDate ?? "—"}</ListTd>
                    <ListTd align="right" className={r.balance > 0.5 ? "font-medium" : "text-muted-foreground"}>
                      {fmt(r.balance, r.invoice.currency)}
                    </ListTd>
                    <ListTd>
                      <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[0.6875rem]", STATE_TONE[r.state])}>
                        {STATE_LABEL[r.state]}
                      </span>
                    </ListTd>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-border/40 bg-surface/40">
                      <ListTd />
                      <td colSpan={9} className="px-4 py-2">
                        {r.payments.length === 0 ? (
                          <p className="t-label text-muted-foreground">
                            No bank transaction linked yet{r.paid > 0.5 ? " — the payment was recorded manually." : "."}
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {r.payments.map((p) => (
                              <li key={p.id} className="flex items-center gap-3 t-label">
                                <span className="tabular-nums text-muted-foreground">{p.date}</span>
                                <span className="truncate">{p.description ?? "Bank transaction"}</span>
                                <span className="ml-auto tabular-nums">{fmt(Math.abs(p.amount), p.currency)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center t-body text-muted-foreground">
                  No invoices match this view.
                </td>
              </tr>
            )}
          </tbody>
        </ListTable>
      </ListTableShell>
    </ProjectsStylePageShell>
  );
}
