import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients, useProjects, useCompanies, contactBelongsTo, MAX_QUOTE_ASSIGNEES } from "@/lib/mock-data";
import { useCompanySalesUsers } from "@/hooks/use-company-users";
import { QuoteAssigneePicker } from "@/components/quote-assignee-picker";
import { previewBulk, describePatch, type BulkPatch, type BulkDoc } from "@/lib/bulk-edit";

const KEEP = "__keep__";
const CLEAR = "__clear__";
const CUSTOM = "__custom__";

export interface BulkEditRow extends BulkDoc {
  id: string;
  number: string;
  companyId: string;
  clientId: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function BulkEditDocDialog({
  open,
  onOpenChange,
  rows,
  noun,
  docType = "invoice",
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: BulkEditRow[];
  noun: string;
  docType?: "invoice" | "quote";
  onApply: (patch: BulkPatch) => void | Promise<void>;
}) {
  const clients = useClients();
  const projects = useProjects();
  const companies = useCompanies();
  const isQuote = docType === "quote";

  /* Ownership */
  const [clientChoice, setClientChoice] = useState(KEEP);
  const [projectChoice, setProjectChoice] = useState(KEEP);
  const [assigneeMode, setAssigneeMode] = useState<typeof KEEP | "add" | "remove" | "replace">(KEEP);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  /* Dates */
  const [issueDate, setIssueDate] = useState("");
  const [dueMode, setDueMode] = useState<typeof KEEP | "set" | "shift">(KEEP);
  const [dueValue, setDueValue] = useState("");
  const [dueShift, setDueShift] = useState("0");
  const [followUp, setFollowUp] = useState(KEEP);
  const [followUpDate, setFollowUpDate] = useState("");

  /* Money & tax */
  const [taxChoice, setTaxChoice] = useState(KEEP);
  const [taxCustom, setTaxCustom] = useState("");
  const [discountChoice, setDiscountChoice] = useState(KEEP);
  const [discountValue, setDiscountValue] = useState("");
  const [currency, setCurrency] = useState(KEEP);

  /* Document setup */
  const [language, setLanguage] = useState(KEEP);
  const [bankAccount, setBankAccount] = useState(KEEP);
  const [signer, setSigner] = useState(KEEP);
  const [subjectMode, setSubjectMode] = useState(KEEP);
  const [subject, setSubject] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientChoice(KEEP); setProjectChoice(KEEP); setAssigneeMode(KEEP); setAssigneeIds([]);
    setIssueDate(""); setDueMode(KEEP); setDueValue(""); setDueShift("0"); setFollowUp(KEEP); setFollowUpDate("");
    setTaxChoice(KEEP); setTaxCustom(""); setDiscountChoice(KEEP); setDiscountValue(""); setCurrency(KEEP);
    setLanguage(KEEP); setBankAccount(KEEP); setSigner(KEEP); setSubjectMode(KEEP); setSubject("");
  }, [open]);

  const companyIds = useMemo(() => [...new Set(rows.map((r) => r.companyId))], [rows]);
  const singleCompanyId = companyIds.length === 1 ? companyIds[0] : undefined;
  const company = companies.find((c) => c.id === singleCompanyId);
  const bankAccounts = company?.bankAccounts ?? [];
  const { users: companyUsers, nameOf } = useCompanySalesUsers(singleCompanyId);

  const availableClients = useMemo(
    () =>
      clients
        .filter((c) => companyIds.every((cid) => contactBelongsTo(c, cid)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clients, companyIds],
  );

  const effectiveClientIds = useMemo(
    () => (clientChoice !== KEEP ? [clientChoice] : [...new Set(rows.map((r) => r.clientId))]),
    [clientChoice, rows],
  );

  const availableProjects = useMemo(
    () =>
      projects
        .filter((p) => companyIds.includes(p.companyId) && effectiveClientIds.includes(p.clientId ?? ""))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects, companyIds, effectiveClientIds],
  );

  const patch = useMemo<BulkPatch>(() => {
    const p: BulkPatch = {};
    if (clientChoice !== KEEP) p.clientId = clientChoice;
    if (projectChoice === CLEAR) p.projectId = null;
    else if (projectChoice !== KEEP) p.projectId = projectChoice;
    if (isQuote && assigneeMode !== KEEP && (assigneeIds.length > 0 || assigneeMode === "replace")) {
      p.assignees = { mode: assigneeMode, ids: assigneeIds };
    }

    if (issueDate) p.issueDate = issueDate;
    if (dueMode === "set" && dueValue) {
      if (isQuote) p.validUntil = { mode: "set", value: dueValue };
      else p.dueDate = { mode: "set", value: dueValue };
    } else if (dueMode === "shift" && Number(dueShift)) {
      const op = { mode: "shift" as const, days: Number(dueShift) };
      if (isQuote) p.validUntil = op; else p.dueDate = op;
    }
    if (isQuote) {
      if (followUp === CLEAR) p.nextFollowUpAt = null;
      else if (followUp === "set" && followUpDate) p.nextFollowUpAt = followUpDate;
    }

    if (taxChoice !== KEEP) {
      const rate = taxChoice === CUSTOM ? Number(taxCustom) : Number(taxChoice);
      if (Number.isFinite(rate) && rate >= 0) p.taxRate = rate;
    }
    if (discountChoice === CLEAR) p.discountPct = null;
    else if (discountChoice === "set" && discountValue !== "" && Number.isFinite(Number(discountValue))) {
      p.discountPct = Number(discountValue);
    }
    if (currency !== KEEP) p.currency = currency;

    if (language !== KEEP) p.language = language;
    if (bankAccount === CLEAR) p.bankAccountId = null;
    else if (bankAccount !== KEEP) p.bankAccountId = bankAccount;
    if (signer === CLEAR) p.signerId = null;
    else if (signer !== KEEP) p.signerId = signer;
    if (subjectMode === CLEAR) p.subject = "";
    else if (subjectMode === "set" && subject.trim()) p.subject = subject.trim();

    return p;
  }, [
    clientChoice, projectChoice, assigneeMode, assigneeIds, isQuote, issueDate, dueMode, dueValue, dueShift,
    followUp, followUpDate, taxChoice, taxCustom, discountChoice, discountValue, currency,
    language, bankAccount, signer, subjectMode, subject,
  ]);

  const { targets, skipped } = useMemo(() => previewBulk(rows, patch), [rows, patch]);
  const hasChange = Object.keys(patch).length > 0;
  const changes = useMemo(
    () =>
      describePatch(patch, {
        client: (id) => clients.find((c) => c.id === id)?.name ?? id,
        project: (id) => projects.find((p) => p.id === id)?.name ?? id,
        user: (id) => nameOf(id) ?? id,
      }),
    [patch, clients, projects, nameOf],
  );

  const skipGroups = useMemo(() => {
    const m = new Map<string, number>();
    skipped.forEach((s) => m.set(s.reason, (m.get(s.reason) ?? 0) + 1));
    return [...m.entries()];
  }, [skipped]);

  const submit = async () => {
    setBusy(true);
    try {
      await onApply(patch);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const plural = (n: number) => `${n} ${noun}${n !== 1 ? "s" : ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk edit {plural(rows.length)}</DialogTitle>
          <DialogDescription>
            Every field defaults to “Keep current” — only what you change is written. One undo reverts the whole batch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <Section title="Ownership">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={clientChoice} onValueChange={setClientChoice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  {availableClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableClients.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No client is shared by every selected company.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectChoice} onValueChange={setProjectChoice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value={CLEAR}>Clear project</SelectItem>
                  {availableProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isQuote && (
              <div className="space-y-1.5">
                <Label>Assignees</Label>
                <Select value={assigneeMode} onValueChange={(v) => setAssigneeMode(v as typeof assigneeMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KEEP}>Keep current</SelectItem>
                    <SelectItem value="add">Add people</SelectItem>
                    <SelectItem value="remove">Remove people</SelectItem>
                    <SelectItem value="replace">Replace with…</SelectItem>
                  </SelectContent>
                </Select>
                {assigneeMode !== KEEP && (
                  <>
                    <QuoteAssigneePicker
                      companyId={singleCompanyId}
                      value={assigneeIds}
                      onChange={setAssigneeIds}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Max {MAX_QUOTE_ASSIGNEES} per quotation — quotes that would exceed it are skipped.
                    </p>
                  </>
                )}
              </div>
            )}
          </Section>

          <Section title="Dates">
            <div className="space-y-1.5">
              <Label>Issue date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>{isQuote ? "Valid until" : "Due date"}</Label>
              <Select value={dueMode} onValueChange={(v) => setDueMode(v as typeof dueMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value="set">Set a date</SelectItem>
                  <SelectItem value="shift">Shift by days</SelectItem>
                </SelectContent>
              </Select>
              {dueMode === "set" && (
                <Input type="date" value={dueValue} onChange={(e) => setDueValue(e.target.value)} />
              )}
              {dueMode === "shift" && (
                <Input
                  type="number"
                  value={dueShift}
                  onChange={(e) => setDueShift(e.target.value)}
                  placeholder="e.g. 15 or -7"
                />
              )}
            </div>

            {isQuote && (
              <div className="space-y-1.5">
                <Label>Next follow-up</Label>
                <Select value={followUp} onValueChange={setFollowUp}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KEEP}>Keep current</SelectItem>
                    <SelectItem value="set">Set a date</SelectItem>
                    <SelectItem value={CLEAR}>Clear</SelectItem>
                  </SelectContent>
                </Select>
                {followUp === "set" && (
                  <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
                )}
              </div>
            )}
          </Section>

          <Section title="Money & tax">
            <div className="space-y-1.5">
              <Label>Tax rate</Label>
              <Select value={taxChoice} onValueChange={setTaxChoice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value="0">0% (exempt)</SelectItem>
                  <SelectItem value="20">20% TVA</SelectItem>
                  <SelectItem value={CUSTOM}>Custom…</SelectItem>
                </SelectContent>
              </Select>
              {taxChoice === CUSTOM && (
                <Input type="number" min={0} max={100} value={taxCustom} onChange={(e) => setTaxCustom(e.target.value)} placeholder="%" />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Global discount</Label>
              <Select value={discountChoice} onValueChange={setDiscountChoice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value="set">Set percentage</SelectItem>
                  <SelectItem value={CLEAR}>Clear discount</SelectItem>
                </SelectContent>
              </Select>
              {discountChoice === "set" && (
                <Input type="number" min={0} max={100} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="%" />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value="MGA">MGA</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Paid, cancelled or part-paid documents are skipped for money and tax changes.
              </p>
            </div>
          </Section>

          <Section title="Document setup">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Bank account</Label>
              <Select value={bankAccount} onValueChange={setBankAccount} disabled={!singleCompanyId || bankAccounts.length === 0}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value={CLEAR}>Company default</SelectItem>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!singleCompanyId && (
                <p className="text-[11px] text-muted-foreground">Select documents from a single company to change the bank account.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Signer</Label>
              <Select value={signer} onValueChange={setSigner} disabled={!singleCompanyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value={CLEAR}>No signature</SelectItem>
                  {companyUsers.map((u) => (
                    <SelectItem key={u.userId} value={u.userId}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {signer !== KEEP && (
                <p className="text-[11px] text-muted-foreground">The stamp is marked for refresh on every touched document.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Object / title</Label>
              <Select value={subjectMode} onValueChange={setSubjectMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Keep current</SelectItem>
                  <SelectItem value="set">Set for all</SelectItem>
                  <SelectItem value={CLEAR}>Clear</SelectItem>
                </SelectContent>
              </Select>
              {subjectMode === "set" && (
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Prestation de services — Août 2026" />
              )}
            </div>
          </Section>

          <div className="rounded-lg border border-border bg-surface-elevated/40 px-3 py-2.5 text-[11px] text-muted-foreground space-y-1.5">
            <div className="text-foreground font-medium">
              {targets.length > 0 ? `${plural(targets.length)} will change` : "Nothing to change yet"}
              {skipped.length > 0 && ` · ${skipped.length} skipped`}
            </div>
            {changes.length > 0 && <div>{changes.join(" · ")}</div>}
            {skipGroups.map(([reason, n]) => (
              <div key={reason} className="text-warning">{n} skipped — {reason}</div>
            ))}
            <div>
              {plural(rows.length)} across {companyIds.length} compan{companyIds.length !== 1 ? "ies" : "y"}. You can undo this in one step.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!hasChange || targets.length === 0 || busy}>
            Update {plural(targets.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
