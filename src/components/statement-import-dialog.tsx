import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  accountsStore, transactionsStore, invoicesStore, invoices as invoicesArr,
  toMGA, FX,
  type Account, type Transaction, type Invoice,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";

/* ─── CSV parsing ───────────────────────────────────────────────────── */

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQ = false;
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === "," || ch === ";" || ch === "\t") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim().length));
}

function detectDelimiter(firstLine: string): string {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of firstLine) if (ch in counts) (counts as Record<string, number>)[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function normalizeHeader(h: string) {
  return h.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

const DATE_HEADERS = ["date", "transactiondate", "valuedate", "postingdate", "datevaleur", "dateoperation"];
const DESC_HEADERS = ["description", "libelle", "label", "narration", "details", "memo", "reference", "ref"];
const AMOUNT_HEADERS = ["amount", "montant", "value"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals", "out"];
const CREDIT_HEADERS = ["credit", "deposit", "deposits", "in"];

function parseNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/\s/g, "").replace(/[^\d,.\-+]/g, "");
  // If both . and , — assume , is thousand sep, . is decimal
  if (cleaned.includes(".") && cleaned.includes(",")) {
    return Number(cleaned.replace(/,/g, "")) || 0;
  }
  // Only , — treat as decimal sep
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    return Number(cleaned.replace(/,/g, ".")) || 0;
  }
  return Number(cleaned) || 0;
}

function parseDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  // ISO yyyy-mm-dd
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // dd/mm/yyyy or dd-mm-yyyy
  m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  matchedInvoiceId?: string;
}

function parseStatement(text: string, account: Account, allInvoices: Invoice[]): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  const rows = parseCSV(lines.join("\n").replace(/,/g, delim === "," ? "," : ",")); // keep simple
  // re-parse with detected delim by rewriting using the actual delimiter logic:
  const raw = lines.map((l) => {
    // simple split honoring quoted fields
    const out: string[] = [];
    let f = "";
    let inQ = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (inQ) { if (c === '"' && l[i + 1] === '"') { f += '"'; i++; } else if (c === '"') inQ = false; else f += c; }
      else if (c === '"') inQ = true;
      else if (c === delim) { out.push(f); f = ""; }
      else f += c;
    }
    out.push(f);
    return out;
  });
  void rows;

  const header = raw[0].map(normalizeHeader);
  const dateIdx = header.findIndex((h) => DATE_HEADERS.includes(h));
  const descIdx = header.findIndex((h) => DESC_HEADERS.includes(h));
  const amtIdx = header.findIndex((h) => AMOUNT_HEADERS.includes(h));
  const debIdx = header.findIndex((h) => DEBIT_HEADERS.includes(h));
  const credIdx = header.findIndex((h) => CREDIT_HEADERS.includes(h));

  const companyInvoices = allInvoices.filter((i) => i.companyId === account.companyId);

  const out: ParsedRow[] = [];
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    const dateStr = dateIdx >= 0 ? row[dateIdx] : row[0];
    const descStr = descIdx >= 0 ? row[descIdx] : row.slice(1, -1).join(" ");
    const date = parseDate(dateStr || "");
    if (!date) continue;
    let amount = 0;
    let type: "income" | "expense" = "expense";
    if (amtIdx >= 0) {
      const n = parseNumber(row[amtIdx] || "");
      if (n === 0) continue;
      amount = Math.abs(n);
      type = n >= 0 ? "income" : "expense";
    } else if (debIdx >= 0 || credIdx >= 0) {
      const deb = debIdx >= 0 ? parseNumber(row[debIdx] || "") : 0;
      const cred = credIdx >= 0 ? parseNumber(row[credIdx] || "") : 0;
      if (cred > 0) { amount = cred; type = "income"; }
      else if (deb > 0) { amount = deb; type = "expense"; }
      else continue;
    } else {
      // best-effort: try last column as amount
      const last = parseNumber(row[row.length - 1] || "");
      if (last === 0) continue;
      amount = Math.abs(last);
      type = last >= 0 ? "income" : "expense";
    }
    const desc = (descStr || "").trim();
    const matchedInvoiceId = autoMatchInvoice(desc, amount, account, companyInvoices, type);
    out.push({ date, description: desc, amount, type, matchedInvoiceId });
  }
  return out;
}

function autoMatchInvoice(
  description: string,
  amount: number,
  account: Account,
  invoices: Invoice[],
  type: "income" | "expense",
): string | undefined {
  if (type !== "income") return undefined;
  const desc = description.toLowerCase().replace(/\s+/g, " ");
  const descNorm = desc.replace(/[^a-z0-9]/g, "");
  // Find candidates by invoice number appearing in description
  const candidates = invoices.filter((i) => {
    const n = i.number.toLowerCase();
    const nNorm = n.replace(/[^a-z0-9]/g, "");
    return n.length >= 3 && (desc.includes(n) || (nNorm.length >= 4 && descNorm.includes(nNorm)));
  });
  if (!candidates.length) return undefined;
  // Convert each invoice's remaining to the account's currency and prefer
  // the closest match (tolerate ±10% to absorb FX drift).
  const amountInMGA = toMGA(amount, account.currency);
  const scored = candidates.map((i) => {
    const remaining = Math.max(0, i.amount - i.paid);
    const remainingInMGA = toMGA(remaining, i.currency);
    const diff = Math.abs(remainingInMGA - amountInMGA);
    const ratio = remainingInMGA > 0 ? diff / remainingInMGA : 1;
    return { i, ratio };
  }).sort((a, b) => a.ratio - b.ratio);
  const best = scored[0];
  // Loose threshold so FX swings don't block the match
  return best.ratio <= 0.15 ? best.i.id : scored[0].i.id;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function StatementImportDialog({
  open, onOpenChange, account,
}: { open: boolean; onOpenChange: (v: boolean) => void; account: Account | null }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState("");

  const reset = () => { setFileName(""); setRows([]); setError(""); };

  const onFile = async (file: File) => {
    setError("");
    setFileName(file.name);
    try {
      const text = await file.text();
      if (!account) return;
      const parsed = parseStatement(text, account, invoicesArr);
      if (!parsed.length) { setError("No transactions detected. Check the CSV headers (date, description, amount or debit/credit)."); setRows([]); return; }
      setRows(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse CSV.");
    }
  };

  const matched = useMemo(() => rows.filter((r) => r.matchedInvoiceId).length, [rows]);

  const doImport = () => {
    if (!account || !rows.length) return;
    const now = new Date().toISOString();
    // Build invoice payment aggregates
    const payments = new Map<string, { total: number; latestDate: string }>();
    for (const r of rows) {
      if (!r.matchedInvoiceId) continue;
      const cur = payments.get(r.matchedInvoiceId) ?? { total: 0, latestDate: r.date };
      cur.total += r.amount;
      if (r.date > cur.latestDate) cur.latestDate = r.date;
      payments.set(r.matchedInvoiceId, cur);
    }

    // Insert transactions
    for (const r of rows) {
      const inv = r.matchedInvoiceId ? invoicesArr.find((i) => i.id === r.matchedInvoiceId) : undefined;
      const tx: Transaction = {
        id: newId("tx"),
        companyId: account.companyId,
        accountId: account.id,
        date: r.date,
        type: r.type,
        category: r.matchedInvoiceId ? "Encaissements clients" : (r.type === "income" ? "Autres encaissements" : "Autres décaissements"),
        description: r.description,
        amount: r.amount,
        currency: account.currency,
        clientId: inv?.clientId,
        projectId: inv?.projectId,
        invoiceId: r.matchedInvoiceId,
        source: "statement",
      };
      transactionsStore.add(tx);
    }

    // Apply payments to invoices
    for (const [invId, { total, latestDate }] of payments) {
      const inv = invoicesArr.find((i) => i.id === invId);
      if (!inv) continue;
      const newPaid = inv.paid + total;
      const newStatus: Invoice["status"] =
        newPaid >= inv.amount && inv.amount > 0 ? "paid"
        : newPaid > 0 ? "partial"
        : differenceInDays(parseISO(inv.dueDate), new Date()) < 0 ? "overdue"
        : "sent";
      invoicesStore.update(invId, {
        paid: newPaid,
        paidDate: !inv.paidDate || latestDate > inv.paidDate ? latestDate : inv.paidDate,
        status: newStatus,
      });
    }

    // Update account: balance + upload metadata
    const delta = rows.reduce((s, r) => s + (r.type === "income" ? r.amount : -r.amount), 0);
    accountsStore.update(account.id, {
      balance: account.balance + delta,
      statementUploadedAt: now,
      statementName: fileName,
    });

    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import bank statement {account ? `· ${account.name}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!rows.length ? (
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface/40 p-10 cursor-pointer hover:bg-surface-elevated/40 transition">
              <Upload className="h-7 w-7 text-muted-foreground" />
              <div className="text-sm">
                <span className="font-medium">Click to upload</span> or drop a CSV file
              </div>
              <p className="text-[11px] text-muted-foreground text-center max-w-md">
                Expected columns: <code>date, description, amount</code> — or <code>date, description, debit, credit</code>.
                Invoices are auto-matched when their number appears in the transaction description.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              />
            </label>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{fileName}</span>
                  <span className="text-muted-foreground">· {rows.length} rows</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-success/40 text-success bg-success/10">
                    {matched} matched
                  </span>
                  <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-muted text-muted-foreground bg-muted/30">
                    {rows.length - matched} unmatched
                  </span>
                  <Button variant="outline" size="sm" onClick={reset}>Clear</Button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-3 py-2">Date</th>
                      <th className="text-left font-medium px-3 py-2">Description</th>
                      <th className="text-left font-medium px-3 py-2">Match</th>
                      <th className="text-right font-medium px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const inv = r.matchedInvoiceId ? invoicesArr.find((x) => x.id === r.matchedInvoiceId) : null;
                      return (
                        <tr key={i} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2 font-tnum text-muted-foreground">{format(parseISO(r.date), "MMM d, yyyy")}</td>
                          <td className="px-3 py-2 truncate max-w-[260px]">{r.description}</td>
                          <td className="px-3 py-2">
                            {inv ? (
                              <span className="inline-flex items-center gap-1 text-success">
                                <CheckCircle2 className="h-3 w-3" /> {inv.number}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </td>
                          <td className={cn("px-3 py-2 text-right font-tnum",
                            r.type === "income" ? "text-success" : "text-destructive")}>
                            {r.type === "income" ? "+" : "−"}{r.amount.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={doImport} disabled={!rows.length}>
            Import {rows.length || ""} {rows.length ? "transactions" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Record-payment dialog (manual single payment for an invoice) ─── */

export function RecordPaymentDialog({
  open, onOpenChange, invoice,
}: { open: boolean; onOpenChange: (v: boolean) => void; invoice: Invoice | null }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Reset on open
  useEffect(() => {
    if (open && invoice) {
      setAmount(String(Math.max(0, invoice.amount - invoice.paid)));
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, invoice]);

  const submit = () => {
    if (!invoice) return;
    const a = Number(amount) || 0;
    if (a <= 0) return;
    const newPaid = invoice.paid + a;
    const newStatus: Invoice["status"] =
      newPaid >= invoice.amount && invoice.amount > 0 ? "paid"
      : newPaid > 0 ? "partial"
      : invoice.status;
    invoicesStore.update(invoice.id, {
      paid: newPaid,
      paidDate: !invoice.paidDate || date > invoice.paidDate ? date : invoice.paidDate,
      status: newStatus,
    });
    // Also drop a transaction so it shows in the ledger
    transactionsStore.add({
      id: newId("tx"),
      companyId: invoice.companyId,
      accountId: "",
      date,
      type: "income",
      category: "Encaissements clients",
      description: `Payment · ${invoice.number}`,
      amount: a,
      currency: invoice.currency,
      clientId: invoice.clientId,
      projectId: invoice.projectId,
      invoiceId: invoice.id,
      source: "manual",
    });
    onOpenChange(false);
  };

  const remaining = invoice ? invoice.amount - invoice.paid : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment {invoice ? `· ${invoice.number}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {invoice && (
            <div className="rounded-md border border-border bg-surface/40 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Invoice total</span><span className="font-tnum">{invoice.amount.toLocaleString()} {invoice.currency}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Already paid</span><span className="font-tnum">{invoice.paid.toLocaleString()} {invoice.currency}</span></div>
              <div className="flex justify-between font-medium"><span>Remaining</span><span className="font-tnum">{remaining.toLocaleString()} {invoice.currency}</span></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment date</Label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div>
              <Label>Amount</Label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm font-tnum" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!amount || Number(amount) <= 0}>Record payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
