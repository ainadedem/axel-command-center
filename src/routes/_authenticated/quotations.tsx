import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useQuotes, useCompanies, useClients, useProjects, quotesStore, purchaseOrdersStore,
  fmt, fmtCompact, type Quote, type QuoteLine, type QuoteStatus, type QuoteMode, type Currency,
, contactBelongsTo } from "@/lib/mock-data";
import { capabilities, levels, getRate, type Capability, type Level, type Unit } from "@/lib/rate-card";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, FileCheck2, Plus, X, Eye } from "lucide-react";
import { DocumentPreview, type DocumentData } from "@/components/document-preview";
import { nextNumber } from "@/lib/numbering";

export const Route = createFileRoute("/_authenticated/quotations")({ component: QuotationsPage });

const statusStyles: Record<QuoteStatus, string> = {
  draft: "border-muted text-muted-foreground bg-muted/30",
  sent: "border-chart-2/40 text-chart-2 bg-chart-2/10",
  accepted: "border-success/40 text-success bg-success/10",
  rejected: "border-destructive/40 text-destructive bg-destructive/10",
  expired: "border-warning/40 text-warning bg-warning/10",
};

function QuotationsPage() {
  return (
    <AppShell>
      <PageHeader title="Quotations" description="Step 1 of the sales process — quote → PO → invoice." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const quotes = useQuotes();
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const baseList = inScope(quotes, scope);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [previewing, setPreviewing] = useState<Quote | null>(null);
  const openCreate = () => { setEditing(null); setOpen(true); };

  const fields: FieldDef<Quote>[] = [
    { key: "number", label: "Number", type: "string", accessor: (q) => q.number, noGroup: true },
    { key: "client", label: "Client", type: "enum", accessor: (q) => clients.find((c) => c.id === q.clientId)?.name ?? "" },
    { key: "project", label: "Project", type: "enum", accessor: (q) => projects.find((p) => p.id === q.projectId)?.name ?? "" },
    { key: "company", label: "Company", type: "enum", accessor: (q) => companies.find((c) => c.id === q.companyId)?.shortName ?? "" },
    { key: "status", label: "Status", type: "enum", accessor: (q) => q.status },
    { key: "currency", label: "Currency", type: "enum", accessor: (q) => q.currency },
    { key: "issueDate", label: "Issued", type: "date", accessor: (q) => q.issueDate, noGroup: true },
    { key: "validUntil", label: "Valid until", type: "date", accessor: (q) => q.validUntil, noGroup: true },
    { key: "amount", label: "Amount", type: "number", accessor: (q) => q.amount, noGroup: true },
  ];
  const view = useDataView<Quote>("quotations", fields);
  const groups = view.apply(baseList);
  const list = groups.flatMap((g) => g.items);

  const convertToPO = (q: Quote) => {
    purchaseOrdersStore.add({
      id: newId("po"),
      number: nextNumber("po", q.companyId),
      companyId: q.companyId,
      clientId: q.clientId,
      projectId: q.projectId,
      quoteId: q.id,
      issueDate: new Date().toISOString().slice(0, 10),
      amount: q.amount,
      currency: q.currency,
      status: "issued",
      lines: q.lines ? q.lines.map((l) => ({ ...l })) : undefined,
    });
    quotesStore.update(q.id, { status: "accepted" });
  };

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <CrudToolbar count={list.length} label="quotations" onCreate={openCreate} />
        <DataToolbar view={view} items={baseList} />
      </div>
      {list.length === 0 ? (
        <EmptyState label="quotations" onCreate={openCreate} />
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-5 py-3">Number</th>
                <th className="text-left font-medium px-5 py-3">Client</th>
                <th className="text-left font-medium px-5 py-3">Project</th>
                <th className="text-left font-medium px-5 py-3">Company</th>
                <th className="text-left font-medium px-5 py-3">Issued</th>
                <th className="text-left font-medium px-5 py-3">Valid until</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-right font-medium px-5 py-3">Amount</th>
                <th className="px-5 py-3 w-28" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={9} />}
                  {g.items.map((q) => {
                const co = companies.find((c) => c.id === q.companyId);
                const cl = clients.find((c) => c.id === q.clientId);
                const proj = q.projectId ? projects.find((p) => p.id === q.projectId) : undefined;
                return (
                  <tr key={q.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40 group">
                    <td className="px-5 py-3.5 font-tnum text-xs text-muted-foreground">{q.number}</td>
                    <td className="px-5 py-3.5 font-medium">{cl?.name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-xs">{proj ? <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5">{proj.name}</span> : <span className="text-muted-foreground/50">—</span>}</td>
                    <td className="px-5 py-3.5">{co && <span className="inline-flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: co.color }} />{co.shortName}</span>}</td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs font-tnum">{format(parseISO(q.issueDate), "MMM d, yyyy")}</td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs font-tnum">{format(parseISO(q.validUntil), "MMM d, yyyy")}</td>
                    <td className="px-5 py-3.5"><span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border", statusStyles[q.status])}>{q.status}</span></td>
                    <td className="px-5 py-3.5 text-right font-tnum">{fmtCompact(q.amount, q.currency)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex gap-1 justify-end items-center">
                        {q.status !== "accepted" && q.status !== "rejected" && (
                          <button onClick={() => convertToPO(q)} title="Convert to PO" className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-success/30 text-success hover:bg-success/10 flex items-center gap-1"><FileCheck2 className="h-3 w-3" /> To PO</button>
                        )}
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                          <button onClick={() => setPreviewing(q)} title="Preview & export PDF" className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Eye className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { setEditing(q); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => confirm(`Delete quote ${q.number}?`) && quotesStore.remove(q.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <QuoteDialog open={open} onOpenChange={setOpen} editing={editing} />
      <DocumentPreview
        open={!!previewing}
        onOpenChange={(v) => { if (!v) setPreviewing(null); }}
        doc={previewing ? quoteToDoc(previewing) : null}
        company={previewing ? companies.find((c) => c.id === previewing.companyId) : undefined}
        client={previewing ? clients.find((c) => c.id === previewing.clientId) : undefined}
        project={previewing?.projectId ? projects.find((p) => p.id === previewing.projectId) : undefined}
      />
    </div>
  );
}

function quoteToDoc(q: Quote): DocumentData {
  return {
    kind: "quote",
    number: q.number,
    status: q.status,
    issueDate: q.issueDate,
    dueDate: q.validUntil,
    amount: q.amount,
    currency: q.currency,
    lines: q.lines,
    notes: q.notes,
  };
}

function QuoteDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Quote | null }) {
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(today);
  const [validUntil, setValidUntil] = useState(addDays(new Date(), 30).toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [mode, setMode] = useState<QuoteMode>("rate-card");
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumber(editing.number); setCompanyId(editing.companyId); setClientId(editing.clientId);
      setProjectId(editing.projectId ?? "");
      setIssueDate(editing.issueDate); setValidUntil(editing.validUntil);
      setCurrency(editing.currency); setStatus(editing.status);
      setMode(editing.mode ?? "rate-card");
      setLines(editing.lines ?? []);
      setNotes(editing.notes ?? "");
    } else {
      const cid = companies[0]?.id ?? "";
      setNumber(cid ? nextNumber("quote", cid) : ""); setCompanyId(cid); setClientId("");
      setProjectId(""); setIssueDate(today); setValidUntil(addDays(new Date(), 30).toISOString().slice(0, 10));
      setCurrency(companies[0]?.baseCurrency ?? "EUR"); setStatus("draft");
      setMode("rate-card");
      setLines([]); setNotes("");
    }
  }, [open, editing, companies, today]);

  useEffect(() => {
    if (!open || editing || !companyId) return;
    setNumber(nextNumber("quote", companyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const companyClients = clients.filter((c) => contactBelongsTo(c, companyId));
  const clientProjects = projects.filter((p) => p.companyId === companyId && p.clientId === clientId);

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0), [lines]);

  const addLine = () => {
    if (mode === "standard") {
      setLines((prev) => [...prev, {
        id: newId("ql"),
        description: "",
        unit: "fixed", quantity: 1, rate: 0,
      }]);
      return;
    }
    const cap: Capability = "CREATIVE";
    const lvl: Level = "P7";
    setLines((prev) => [...prev, {
      id: newId("ql"),
      description: `${cap} — ${levels.find((l) => l.code === lvl)?.title ?? lvl}`,
      capability: cap, level: lvl, unit: "day", quantity: 1,
      rate: getRate(lvl, "day", currency),
    }]);
  };

  const updateLine = (id: string, patch: Partial<QuoteLine>) => {
    setLines((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l, ...patch };
      if (patch.capability === "PROJECT") {
        next.level = undefined;
        next.unit = "fixed" as Unit;
        next.description = next.description || "PROJECT — Fixed fee";
      }
      // Recompute rate when capability/level/unit/currency drivers change.
      if ((patch.level || patch.unit || patch.capability) && next.level && next.unit !== "fixed") {
        next.rate = getRate(next.level as Level, next.unit as Unit, currency);
        if (patch.capability || patch.level) {
          const title = levels.find((x) => x.code === next.level)?.title ?? next.level;
          next.description = `${next.capability} — ${title}`;
        }
      }
      return next;
    }));
  };

  // When currency changes, re-price every rate-card line.
  useEffect(() => {
    setLines((prev) => prev.map((l) => l.level ? { ...l, rate: getRate(l.level as Level, l.unit, currency) } : l));
  }, [currency]);

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const submit = () => {
    if (!number.trim() || !companyId || !clientId) return;
    const data = { number, companyId, clientId, projectId: projectId || undefined, issueDate, validUntil, amount: Math.round(total), currency, status, mode, lines, notes: notes || undefined };
    if (editing) quotesStore.update(editing.id, data);
    else quotesStore.add({ id: newId("q"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit quote" : "New quote"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Number</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as QuoteStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Company</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setClientId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); }}>
                <SelectTrigger><SelectValue placeholder={companyClients.length ? "Select" : "Create client first"} /></SelectTrigger>
                <SelectContent>{companyClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Project</Label>
              <Select value={projectId || "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? "" : v)} disabled={!clientId}>
                <SelectTrigger><SelectValue placeholder={clientId ? (clientProjects.length ? "Select project" : "No projects yet") : "Select client first"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No project —</SelectItem>
                  {clientProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <div className="mt-1 inline-flex rounded-md border border-border overflow-hidden text-xs">
                {(["EUR", "USD", "MGA"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={cn(
                      "px-3 py-1.5 font-tnum",
                      currency === c ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-surface-elevated",
                      c !== "EUR" && "border-l border-border"
                    )}
                  >
                    {c === "EUR" ? "€ EUR" : c === "USD" ? "$ USD" : "Ar MGA"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div><Label>Valid until</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          </div>

          {/* Pricing mode */}
          <div className="pt-2">
            <Label>Quotation type</Label>
            <div className="mt-1 inline-flex rounded-md border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setMode("rate-card")}
                className={cn("px-3 py-1.5", mode === "rate-card" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-surface-elevated")}
              >Rate card</button>
              <button
                type="button"
                onClick={() => setMode("standard")}
                className={cn("px-3 py-1.5 border-l border-border", mode === "standard" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-surface-elevated")}
              >Standard</button>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label>{mode === "rate-card" ? "Line items (priced from rate card)" : "Line items"}</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5" /> Add line</Button>
            </div>
            {lines.length === 0 ? (
              <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md py-6 text-center">{mode === "rate-card" ? "No lines yet — add roles from the rate card." : "No lines yet — add a free-form item."}</p>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface-elevated/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-2 py-2">Description</th>
                      {mode === "rate-card" && <th className="text-left font-medium px-2 py-2 w-28">Capability</th>}
                      {mode === "rate-card" && <th className="text-left font-medium px-2 py-2 w-20">Level</th>}
                      <th className="text-left font-medium px-2 py-2 w-20">Unit</th>
                      <th className="text-right font-medium px-2 py-2 w-20">Qty</th>
                      <th className="text-right font-medium px-2 py-2 w-28">Rate ({currency})</th>
                      <th className="text-right font-medium px-2 py-2 w-28">Amount ({currency})</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-t border-border/40">
                        <td className="px-2 py-1.5"><Input className="h-8 text-xs" value={l.description} onChange={(e) => updateLine(l.id, { description: e.target.value })} /></td>
                        {mode === "rate-card" && (
                          <td className="px-2 py-1.5">
                            <Select value={l.capability ?? "CREATIVE"} onValueChange={(v) => updateLine(l.id, { capability: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{capabilities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                        )}
                        {mode === "rate-card" && (
                          <td className="px-2 py-1.5">
                            {l.capability === "PROJECT" ? (
                              <span className="text-xs text-muted-foreground px-2 py-1.5 block">—</span>
                            ) : (
                              <Select value={l.level ?? "P7"} onValueChange={(v) => updateLine(l.id, { level: v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{levels.map((lv) => <SelectItem key={lv.code} value={lv.code}>{lv.code} · {lv.title}</SelectItem>)}</SelectContent>
                              </Select>
                            )}
                          </td>
                        )}
                        <td className="px-2 py-1.5">
                          <Select value={l.unit} onValueChange={(v) => updateLine(l.id, { unit: v as Unit })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hour">Hour</SelectItem>
                              <SelectItem value="day">Day</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5"><Input type="number" className="h-8 text-xs text-right" value={l.quantity} onChange={(e) => updateLine(l.id, { quantity: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <Input type="number" className="h-8 text-xs text-right pr-8" value={l.rate} onChange={(e) => updateLine(l.id, { rate: Number(e.target.value), level: undefined })} />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                              {currency === "EUR" ? "€" : currency === "USD" ? "$" : "Ar"}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-tnum">{fmt((Number(l.quantity) || 0) * (Number(l.rate) || 0), currency)}</td>
                        <td className="px-2 py-1.5"><button type="button" onClick={() => removeLine(l.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-surface-elevated/30">
                      <td colSpan={mode === "rate-card" ? 6 : 4} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">Total</td>
                      <td className="px-2 py-2 text-right font-tnum font-semibold">{fmt(total, currency)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {mode === "rate-card" ? (
              <p className="text-[11px] text-muted-foreground">Rates auto-fill from the rate card (benefits 35%, OH 70%, margin 15%, 1760h / 218d per year). Override by editing the Rate cell — that detaches the line from the card.</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Standard quotation — enter description, quantity and unit price freely. Nothing is auto-priced.</p>
            )}
          </div>

          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the client" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
