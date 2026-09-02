/**
 * My tasks — one screen answering "what is waiting on me?".
 *
 * Two kinds of work land here: decisions only this person can make (payment
 * approvals at their stage) and the business to-dos derived from the live
 * documents. Every row carries the context it belongs to — project, client,
 * quotation, invoice — so nothing has to be looked up elsewhere.
 */
import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowRight, BadgeCheck, Building2, CheckCircle2,
  FileText, FolderKanban, Receipt, Users,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ProjectsStylePageShell } from "@/components/projects-style-page-shell";
import { Button } from "@/components/ui/button";
import { inScope, useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveRole } from "@/lib/use-effective-role";
import {
  useQuotes, useInvoices, usePurchaseOrders, useAccounts, useProjects, useClients,
  usePaymentRequests, useSuppliers, fmt, fmtCompact, toMGA,
} from "@/lib/mock-data";
import { buildNextActions, type NextAction } from "@/lib/next-actions";
import { runLabel, STATUS_LABEL } from "@/lib/payment-approvals";
import { clientLabel } from "@/lib/client-name";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  component: MyTasksPage,
  head: () => ({
    meta: [
      { title: "My tasks | Axel" },
      { name: "description", content: "Approvals and business to-dos waiting on you, linked to their project, client, quotation and invoice." },
    ],
  }),
});

function MyTasksPage() {
  return (
    <AppShell>
      <PageHeader
        title="My tasks"
        description="Everything waiting on you: payments to decide and money to chase, each linked to its project, client and documents."
      />
      <MyTasksBody />
    </AppShell>
  );
}

const TONE_STYLE: Record<NextAction["tone"], string> = {
  urgent: "border-destructive/30 bg-destructive/5",
  attention: "border-warning/30 bg-warning/5",
  routine: "border-border bg-surface",
};

function MyTasksBody() {
  const { scope } = useCompany();
  const { user } = useAuth();
  const { canSeeFinance, isAdmin, isGroupAdmin } = useEffectiveRole();

  const quotes = useQuotes();
  const invoices = useInvoices();
  const purchaseOrders = usePurchaseOrders();
  const accounts = useAccounts();
  const projects = useProjects();
  const clients = useClients();
  const suppliers = useSuppliers();
  const requests = usePaymentRequests();

  /** Requests this person is actually expected to act on right now. */
  const myApprovals = useMemo(() => {
    return inScope(requests, scope).filter((r) => {
      if (r.requestedBy === user?.id && r.status === "draft") return true;
      if (r.status === "submitted") return canSeeFinance || isAdmin;
      if (r.status === "reviewed") return isGroupAdmin;
      if (r.status === "approved") return canSeeFinance || isAdmin;
      return false;
    });
  }, [requests, scope, user?.id, canSeeFinance, isAdmin, isGroupAdmin]);

  const actions = useMemo(
    () =>
      buildNextActions({
        quotes: inScope(quotes, scope),
        invoices: inScope(invoices, scope),
        purchaseOrders: inScope(purchaseOrders, scope),
        accounts: inScope(accounts, scope),
      }),
    [quotes, invoices, purchaseOrders, accounts, scope],
  );

  const approvalMGA = myApprovals.reduce((s, r) => s + toMGA(r.amount, r.currency), 0);
  const urgent = actions.filter((a) => a.tone === "urgent").length;

  const contextFor = (projectId?: string, clientId?: string) => {
    const project = projects.find((p) => p.id === projectId);
    const client = clients.find((c) => c.id === (clientId ?? project?.clientId));
    return { project, client };
  };

  return (
    <ProjectsStylePageShell>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Approvals waiting on you" value={String(myApprovals.length)} sub="Payment decisions" />
        <KpiCard label="Value to decide" value={fmtCompact(approvalMGA, "MGA")} sub="Across those requests" />
        <KpiCard label="Urgent to-dos" value={String(urgent)} tone={urgent > 0 ? "danger" : "success"} sub="Costing money today" />
        <KpiCard label="Other to-dos" value={String(actions.length - urgent)} sub="Keep the pipeline clean" />
      </div>

      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-semibold">
          <BadgeCheck className="size-3.5 text-primary" /> Approvals waiting on you
        </h2>
        {myApprovals.length === 0 ? (
          <EmptyLine icon={CheckCircle2} text="No payment decision is waiting on you." />
        ) : (
          <ul className="space-y-1.5">
            {myApprovals.map((r) => {
              const { project, client } = contextFor(r.projectId);
              const payee = suppliers.find((s) => s.id === r.supplierId)?.name ?? r.payee;
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.8125rem] font-medium">{r.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Chip icon={Receipt}>{fmt(r.amount, r.currency)}</Chip>
                      <Chip>{STATUS_LABEL[r.status]}</Chip>
                      {r.runId && <Chip>{runLabel(r.runId)} run</Chip>}
                      {r.offCycle && <Chip tone="danger" icon={AlertTriangle}>Off-cycle</Chip>}
                      {payee && <Chip icon={Users}>{payee}</Chip>}
                      {project && <Chip icon={FolderKanban}>{project.name}</Chip>}
                      {client && <Chip icon={Building2}>{clientLabel(client)}</Chip>}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/payment-approvals">Review<ArrowRight className="ml-1 size-3.5" /></Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-semibold">
          <FileText className="size-3.5 text-primary" /> Business to-dos
        </h2>
        {actions.length === 0 ? (
          <EmptyLine icon={CheckCircle2} text="Nothing needs attention — the pipeline is clean." />
        ) : (
          <ul className="space-y-1.5">
            {actions.map((a) => (
              <li
                key={a.id}
                className={cn("flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2", TONE_STYLE[a.tone])}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.8125rem] font-medium">{a.title}</div>
                  <p className="mt-0.5 text-[0.75rem] text-muted-foreground">{a.why}</p>
                  {a.amountMGA ? (
                    <div className="mt-1"><Chip icon={Receipt}>{fmtCompact(a.amountMGA, "MGA")} at stake</Chip></div>
                  ) : null}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={a.to} search={a.search as never}>{a.cta}<ArrowRight className="ml-1 size-3.5" /></Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ProjectsStylePageShell>
  );
}

function Chip({
  children, icon: Icon, tone,
}: { children: React.ReactNode; icon?: React.ElementType; tone?: "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem]",
        tone === "danger" ? "bg-destructive/12 text-destructive" : "bg-surface text-muted-foreground",
      )}
    >
      {Icon ? <Icon className="size-3" /> : null}
      <span className="max-w-[14rem] truncate">{children}</span>
    </span>
  );
}

function EmptyLine({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-[0.8125rem] text-muted-foreground">
      <Icon className="size-4 text-success" /> {text}
    </div>
  );
}
