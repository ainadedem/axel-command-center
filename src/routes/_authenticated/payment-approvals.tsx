import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ProjectsStylePageShell, RecordCountChip } from "@/components/projects-style-page-shell";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd } from "@/components/list-table";
import { DetailPanel, DetailField } from "@/components/master-detail";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { inScope, useCompany } from "@/lib/company-context";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { useAuth } from "@/lib/auth-context";
import { useCreateAction } from "@/lib/create-action";
import {
  useSuppliers, useProjects, fmt,
  paymentRequestsStore,
  type Currency, type PaymentRequest, type PaymentRequestKind, type PaymentRequestStatus,
} from "@/lib/mock-data";
import {
  approvalTotals, decidePaymentRequest, groupByRun, isOpen, nextStepFor,
  runDateFor, runLabel, isPastCutoff, STATUS_LABEL, STATUS_TONE,
} from "@/lib/payment-approvals";
import { usePaymentRequests } from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/payment-approvals")({
  component: PaymentApprovalsPage,
});

const KIND_LABEL: Record<PaymentRequestKind, string> = {
  bill: "Supplier bill",
  reimbursement: "Reimbursement",
  advance: "Advance",
  other: "Other",
};

type Filter = "open" | "mine" | "all";

function PaymentApprovalsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Payment approvals"
        description="Every outgoing payment is approved in one weekly run on Thursday. Requests submitted before Wednesday 17:00 join that week's run; anything urgent needs a written justification."
      />
      <ApprovalsBody />
    </AppShell>
  );
}

function ApprovalsBody() {
  const { scope } = useCompany();
  const { canSeeFinance, isAdmin, isGroupAdmin, roleResolved } = useEffectiveRole();
  const { user } = useAuth();
  const requests = usePaymentRequests();
  const suppliers = useSuppliers();
  const projects = useProjects();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const openCreate = useCallback(() => setCreateOpen(true), []);
  useCreateAction(openCreate);

  const scoped = useMemo(() => inScope(requests, scope), [requests, scope]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((r) => {
      if (filter === "open" && !isOpen(r)) return false;
      if (filter === "mine" && r.requestedBy !== user?.id) return false;
      if (!q) return true;
      const supplier = suppliers.find((s) => s.id === r.supplierId)?.name ?? "";
      return (
        r.title.toLowerCase().includes(q) ||
        (r.payee ?? "").toLowerCase().includes(q) ||
        supplier.toLowerCase().includes(q)
      );
    });
  }, [scoped, filter, query, user?.id, suppliers]);

  const groups = useMemo(() => groupByRun(filtered), [filtered]);
  const totals = useMemo(() => approvalTotals(scoped), [scoped]);
  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  const thisRun = runDateFor();

  const payeeOf = (r: PaymentRequest) =>
    suppliers.find((s) => s.id === r.supplierId)?.name ?? r.payee ?? "—";

  const decide = async (r: PaymentRequest, decision: "review" | "approve" | "reject" | "pay") => {
    let note: string | undefined;
    if (decision === "reject") {
      const answer = window.prompt("Why is this payment rejected?");
      if (!answer || !answer.trim()) return;
      note = answer.trim();
    }
    setBusy(true);
    const res = await decidePaymentRequest(r.id, decision, note);
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(`Payment ${STATUS_LABEL[res.request.status].toLowerCase()}.`);
  };

  const submit = (r: PaymentRequest) => {
    const runDate = runDateFor();
    paymentRequestsStore.update(r.id, {
      status: "submitted",
      submittedAt: new Date().toISOString(),
      runId: r.runId ?? runDate,
    });
    toast.success(`Sent for review — scheduled for ${runLabel(runDate)}.`);
  };

  if (roleResolved && !canSeeFinance && scoped.every((r) => r.requestedBy !== user?.id)) {
    // Requesters still see their own requests; everyone else needs finance access.
    if (!scoped.length) {
      return (
        <div className="p-8 text-sm text-muted-foreground">
          You have no payment requests yet. Raise one from an expense to start the approval flow.
        </div>
      );
    }
  }

  return (
    <>
      <ProjectsStylePageShell
        detail={
          selected ? (
            <DetailPanel
              title={selected.title}
              eyebrow={`${KIND_LABEL[selected.kind]} · ${payeeOf(selected)}`}
              subtitle={nextStepFor(selected)}
              onClose={() => setSelectedId(null)}
              actions={
                <>
                  {selected.status === "draft" && (
                    <Button size="sm" onClick={() => submit(selected)}>Submit for review</Button>
                  )}
                  {selected.status === "submitted" && (canSeeFinance || isAdmin) && (
                    <Button size="sm" disabled={busy} onClick={() => decide(selected, "review")}>
                      Finance review done
                    </Button>
                  )}
                  {(selected.status === "reviewed" || selected.status === "submitted") && isGroupAdmin && (
                    <Button size="sm" disabled={busy} onClick={() => decide(selected, "approve")}>
                      Approve payment
                    </Button>
                  )}
                  {selected.status === "approved" && (canSeeFinance || isAdmin) && (
                    <Button size="sm" disabled={busy} onClick={() => decide(selected, "pay")}>
                      Mark paid
                    </Button>
                  )}
                  {isOpen(selected) && (canSeeFinance || isAdmin) && selected.status !== "draft" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(selected, "reject")}>
                      Reject
                    </Button>
                  )}
                </>
              }
            >
              <div className="rounded-lg border border-border/60 p-2">
                <DetailField label="Amount" value={fmt(selected.amount, selected.currency)} mono />
                <DetailField label="Status" value={STATUS_LABEL[selected.status]} />
                <DetailField label="Run day" value={selected.runId ? runLabel(selected.runId) : "Not scheduled"} />
                <DetailField label="Needed by" value={selected.neededBy ?? "—"} />
                <DetailField
                  label="Project"
                  value={projects.find((p) => p.id === selected.projectId)?.name ?? "—"}
                />
                <DetailField label="Details" value={selected.description ?? "—"} />
                {selected.offCycle && (
                  <DetailField
                    label="Off-cycle"
                    value={selected.offCycleReason ?? "Urgent payment outside the Thursday run"}
                  />
                )}
                {selected.rejectionReason && (
                  <DetailField label="Rejected because" value={selected.rejectionReason} />
                )}
              </div>
            </DetailPanel>
          ) : null
        }
        kpis={
          <>
            <KpiCard label="Awaiting review" value={String(totals.awaitingReview)} sub="Finance to check" />
            <KpiCard label="Awaiting approval" value={String(totals.awaitingApproval)} sub="Final sign-off" tone="warning" />
            <KpiCard label="Approved to pay" value={fmt(totals.approvedAmount, "MGA")} tone="success" sub={runLabel(thisRun)} />
            <KpiCard label="Off-cycle" value={String(totals.offCycle)} tone={totals.offCycle ? "danger" : "default"} sub="Outside the weekly run" />
          </>
        }
        toolbar={
          <>
            <div className="relative min-w-[12rem] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search payee or subject"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["open", "mine", "all"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs transition-colors",
                    filter === f ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f === "open" ? "Open" : f === "mine" ? "My requests" : "All"}
                </button>
              ))}
            </div>
            <RecordCountChip count={filtered.length} total={scoped.length} label="requests" filtered={filtered.length !== scoped.length} />
            <Button size="sm" className="h-8" onClick={openCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Request payment
            </Button>
          </>
        }
      >
        {groups.length === 0 ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Nothing waiting. New requests appear here and are batched into the next Thursday run.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.runDate} className="space-y-1.5">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="text-xs font-medium">{runLabel(g.runDate)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {isPastCutoff(g.runDate) ? "cut-off passed" : "open until Wednesday 17:00"}
                  </span>
                </div>
                <ListTableShell scrollX stickyHeader>
                  <ListTable>
                    <thead>
                      <ListHeadRow>
                        <ListTh width="26%">Payment</ListTh>
                        <ListTh width="18%">Payee</ListTh>
                        <ListTh width="12%">Type</ListTh>
                        <ListTh width="14%" align="right">Amount</ListTh>
                        <ListTh width="12%">Needed by</ListTh>
                        <ListTh width="18%">Status</ListTh>
                      </ListHeadRow>
                    </thead>
                    <tbody>
                      {g.requests.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedId(r.id)}
                          className={cn(
                            "cursor-pointer border-b border-border/40 transition-colors hover:bg-surface-elevated/40",
                            selectedId === r.id && "bg-surface-elevated/60",
                          )}
                        >
                          <ListTd title={r.title}>
                            <span className="inline-flex items-center gap-1.5">
                              {r.offCycle && <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Off-cycle" />}
                              {r.title}
                            </span>
                          </ListTd>
                          <ListTd>{payeeOf(r)}</ListTd>
                          <ListTd>{KIND_LABEL[r.kind]}</ListTd>
                          <ListTd align="right">{fmt(r.amount, r.currency)}</ListTd>
                          <ListTd>{r.neededBy ?? "—"}</ListTd>
                          <ListTd>
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px]", STATUS_TONE[r.status])}>
                              {STATUS_LABEL[r.status]}
                            </span>
                          </ListTd>
                        </tr>
                      ))}
                    </tbody>
                  </ListTable>
                </ListTableShell>
              </div>
            ))}
          </div>
        )}
      </ProjectsStylePageShell>

      <NewRequestDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function NewRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { scope, accessibleCompanies } = useCompany();
  const { user } = useAuth();
  const suppliers = useSuppliers();

  const defaultCompany = scope.id === "company" ? scope.companyId : accessibleCompanies[0]?.id ?? "";
  const [companyId, setCompanyId] = useState(defaultCompany);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PaymentRequestKind>("bill");
  const [supplierId, setSupplierId] = useState<string>("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("MGA");
  const [neededBy, setNeededBy] = useState("");
  const [description, setDescription] = useState("");
  const [offCycle, setOffCycle] = useState(false);
  const [offCycleReason, setOffCycleReason] = useState("");

  const runDate = runDateFor();
  const valid =
    title.trim().length > 0 &&
    Number(amount) > 0 &&
    (companyId || defaultCompany) &&
    (!offCycle || offCycleReason.trim().length > 0);

  const reset = () => {
    setTitle(""); setSupplierId(""); setPayee(""); setAmount("");
    setNeededBy(""); setDescription(""); setOffCycle(false); setOffCycleReason("");
  };

  const save = (submitNow: boolean) => {
    const status: PaymentRequestStatus = submitNow ? "submitted" : "draft";
    paymentRequestsStore.add({
      id: newId("pay-req"),
      companyId: companyId || defaultCompany,
      runId: runDate,
      kind,
      supplierId: supplierId || undefined,
      payee: payee.trim() || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      amount: Number(amount),
      currency,
      neededBy: neededBy || undefined,
      status,
      offCycle,
      offCycleReason: offCycle ? offCycleReason.trim() : undefined,
      requestedBy: user?.id,
      submittedAt: submitNow ? new Date().toISOString() : undefined,
    });
    toast.success(submitNow ? `Sent for review — ${runLabel(runDate)} run.` : "Saved as a draft.");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a payment</DialogTitle>
          <DialogDescription>
            Payments are released every Thursday. This one is scheduled for {runLabel(runDate)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pa-title">What is being paid</Label>
            <Input id="pa-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Office rent — September" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as PaymentRequestKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as PaymentRequestKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!supplierId && (
            <div className="space-y-1.5">
              <Label htmlFor="pa-payee">Pay to</Label>
              <Input id="pa-payee" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Person or company" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="pa-amount">Amount</Label>
              <Input id="pa-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["MGA", "EUR", "USD"] as Currency[]).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-needed">Needed by</Label>
            <Input id="pa-needed" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-desc">Details</Label>
            <Textarea id="pa-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Invoice reference, context…" />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <div>
              <div className="text-xs font-medium">Cannot wait for Thursday</div>
              <div className="text-[11px] text-muted-foreground">Off-cycle payments need a written reason.</div>
            </div>
            <Switch checked={offCycle} onCheckedChange={setOffCycle} />
          </div>

          {offCycle && (
            <Textarea
              rows={2}
              value={offCycleReason}
              onChange={(e) => setOffCycleReason(e.target.value)}
              placeholder="Why this payment cannot wait for the weekly run"
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => save(false)} disabled={!valid}>Save draft</Button>
          <Button onClick={() => save(true)} disabled={!valid}>Submit for review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
