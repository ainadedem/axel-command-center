import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Printer, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  fmt, type Company, type Client, type Project, type Currency, type QuoteLine,
} from "@/lib/mock-data";

export type DocKind = "invoice" | "po" | "quote";

export interface DocumentData {
  kind: DocKind;
  number: string;
  status: string;
  issueDate: string;
  /** Due date (invoice) or "valid until" (quote). */
  dueDate?: string;
  paidDate?: string;
  amount: number;
  paid?: number;
  currency: Currency;
  lines?: QuoteLine[];
  notes?: string;
  /** Client-side reference, used on POs. */
  clientReference?: string;
  /** Cross-references printed on the doc (e.g. quote # on a PO, PO # on an invoice). */
  references?: Array<{ label: string; value: string }>;
  /** Tax breakdown (used on quotes). */
  taxRate?: number;
  taxAmount?: number;
  totalAmount?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: DocumentData | null;
  company?: Company;
  client?: Client;
  project?: Project;
}

export function DocumentPreview({ open, onOpenChange, doc, company, client, project }: Props) {
  const [showStatus, setShowStatus] = useState(true);

  const html = useMemo(() => {
    if (!doc) return "";
    return buildHTML({ doc, company, client, project, showStatus });
  }, [doc, company, client, project, showStatus]);

  const printPdf = () => {
    if (!doc) return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(buildPrintableDocument({ doc, company, client, project, showStatus }));
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="text-sm font-medium">{titleFor(doc?.kind)} preview · {doc?.number}</div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox checked={showStatus} onCheckedChange={(v) => setShowStatus(!!v)} />
              Show status
            </label>
            <Button size="sm" variant="outline" onClick={printPdf}><Printer className="h-3.5 w-3.5 mr-1.5" />Print</Button>
            <Button size="sm" onClick={printPdf}><Download className="h-3.5 w-3.5 mr-1.5" />Export PDF</Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="overflow-y-auto bg-neutral-200 dark:bg-neutral-900 p-6 flex justify-center">
          <div
            className="bg-white text-neutral-900 shadow-xl"
            style={{ width: "210mm", minHeight: "297mm", padding: "22mm" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function titleFor(k?: DocKind) {
  if (k === "po") return "Purchase order";
  if (k === "quote") return "Quotation";
  return "Invoice";
}

function headingFor(k: DocKind) {
  if (k === "po") return "PURCHASE ORDER";
  if (k === "quote") return "QUOTATION";
  return "INVOICE";
}

function buildHTML({ doc, company, client, project, showStatus }: { doc: DocumentData; company?: Company; client?: Client; project?: Project; showStatus?: boolean }) {
  const rawColor = company?.color ?? "#1e293b";
  // Validate against a strict CSS color allowlist to prevent CSS/script injection
  // via the company.color field (it is embedded verbatim in a <style> block below).
  const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)|oklch\(\s*[\d.%\s]+\)|[a-zA-Z]{3,30})$/;
  const accent = SAFE_COLOR.test(rawColor.trim()) ? rawColor.trim() : "#1e293b";
  const issued = format(parseISO(doc.issueDate), "MMM d, yyyy");
  const due = doc.dueDate ? format(parseISO(doc.dueDate), "MMM d, yyyy") : null;
  const paidOn = doc.paidDate ? format(parseISO(doc.paidDate), "MMM d, yyyy") : null;
  const balance = (doc.amount ?? 0) - (doc.paid ?? 0);

  const companyLines = [
    company?.legalName ?? company?.name,
    company?.address,
    company?.email,
    company?.phone,
  ].filter(Boolean) as string[];
  const companyLegal = [
    company?.nif && `NIF ${company.nif}`,
    company?.stat && `STAT ${company.stat}`,
  ].filter(Boolean) as string[];
  const clientLines = [
    client?.name, client?.address, client?.email, client?.phone,
  ].filter(Boolean) as string[];
  const clientLegal = [
    client?.nif && `NIF ${client.nif}`,
    client?.stat && `STAT ${client.stat}`,
  ].filter(Boolean) as string[];
  const bank = [
    company?.bankName && `Bank: ${company.bankName}`,
    company?.bankAccount && `Account / IBAN: ${company.bankAccount}`,
    company?.bankSwift && `SWIFT / BIC: ${company.bankSwift}`,
  ].filter(Boolean) as string[];

  const statusColors: Record<string, string> = {
    draft: "#71717a", sent: "#0891b2", partial: "#ca8a04", paid: "#16a34a",
    overdue: "#dc2626", cancelled: "#475569", issued: "#0891b2",
    fulfilled: "#16a34a", accepted: "#16a34a", rejected: "#dc2626",
    expired: "#ca8a04",
  };

  const dueLabel = doc.kind === "quote" ? "Valid until" : "Due";

  // Line items: either explicit lines, or single-row fallback.
  const linesHtml = doc.lines && doc.lines.length > 0
    ? doc.lines.map((l) => {
        const qty = Number(l.quantity) || 0;
        const rate = Number(l.rate) || 0;
        const total = qty * rate;
        const sub = [l.capability, l.level].filter(Boolean).join(" · ");
        return `
          <tr>
            <td>
              <div style="font-weight: 600;">${esc(l.description || "—")}</div>
              ${sub ? `<div style="color: #64748b; font-size: 10px; margin-top: 2px;">${esc(sub)}</div>` : ""}
            </td>
            <td class="num">${qty.toLocaleString()}</td>
            <td class="num">${esc(l.unit)}</td>
            <td class="num">${fmt(rate, doc.currency)}</td>
            <td class="num">${fmt(total, doc.currency)}</td>
          </tr>
        `;
      }).join("")
    : `
      <tr>
        <td>
          <div style="font-weight: 600;">${esc(project?.name ?? "Professional services")}</div>
          ${project ? `<div style="color: #64748b; font-size: 10px; margin-top: 2px;">Project · ${esc(project.name)}</div>` : ""}
        </td>
        <td class="num">1</td>
        <td class="num">fixed</td>
        <td class="num">${fmt(doc.amount, doc.currency)}</td>
        <td class="num">${fmt(doc.amount, doc.currency)}</td>
      </tr>
    `;

  const refsHtml = (doc.references ?? []).filter((r) => r.value)
    .map((r) => `<div><strong>${esc(r.label)}:</strong> ${esc(r.value)}</div>`).join("");

  const logoHtml = company?.logoUrl
    ? `<img src="${esc(company.logoUrl)}" alt="${esc(company?.name ?? "")}" style="max-height: 52px; max-width: 180px; object-fit: contain; margin-bottom: 12px;" />`
    : "";

  return `
    <style>
      .doc { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.5; }
      .doc h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: ${accent}; }
      .doc h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; margin: 0 0 6px; font-weight: 600; }
      .doc .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
      .doc .meta { text-align: right; font-size: 11px; }
      .doc .pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: white; background: ${statusColors[doc.status] ?? "#475569"}; }
      .doc .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 28px; }
      .doc .party div { margin-bottom: 2px; }
      .doc .legal { margin-top: 6px; color: #64748b; font-size: 10px; }
      .doc table { width: 100%; border-collapse: collapse; margin-top: 32px; font-size: 11px; }
      .doc th { text-align: left; padding: 10px 8px; background: #f8fafc; border-bottom: 2px solid ${accent}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
      .doc td { padding: 12px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      .doc .num { text-align: right; font-variant-numeric: tabular-nums; }
      .doc .totals { margin-top: 20px; margin-left: auto; width: 280px; font-size: 11px; }
      .doc .totals .line { display: flex; justify-content: space-between; padding: 6px 0; }
      .doc .totals .grand { border-top: 2px solid ${accent}; margin-top: 6px; padding-top: 10px; font-size: 14px; font-weight: 700; }
      .doc .totals .due { color: ${balance > 0 ? "#dc2626" : "#16a34a"}; font-weight: 700; }
      .doc .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; }
      .doc .bank { margin-top: 16px; padding: 12px 16px; background: #f8fafc; border-left: 3px solid ${accent}; font-size: 11px; }
      .doc .notes { margin-top: 16px; padding: 12px 16px; background: #fffaf0; border-left: 3px solid #ca8a04; font-size: 11px; color: #475569; }
    </style>
    <div class="doc">
      <div class="row">
        <div>
          ${logoHtml}
          <h1>${headingFor(doc.kind)}</h1>
          <div style="margin-top: 8px; font-size: 13px; font-weight: 600;">${esc(doc.number)}</div>
          ${refsHtml ? `<div style="margin-top: 6px; font-size: 11px; color: #475569;">${refsHtml}</div>` : ""}
        </div>
        <div class="meta">
          ${showStatus ? `<div class="pill">${esc(doc.status)}</div>` : ""}
          <div style="margin-top: 10px;"><strong>Issued:</strong> ${issued}</div>
          ${due ? `<div><strong>${dueLabel}:</strong> ${due}</div>` : ""}
          ${paidOn ? `<div><strong>Paid:</strong> ${paidOn}</div>` : ""}
          ${doc.clientReference ? `<div><strong>Client ref:</strong> ${esc(doc.clientReference)}</div>` : ""}
        </div>
      </div>

      <div class="grid">
        <div class="party">
          <h2>From</h2>
          ${companyLines.map((l) => `<div>${esc(l)}</div>`).join("")}
          ${companyLegal.length ? `<div class="legal">${companyLegal.map(esc).join(" · ")}</div>` : ""}
        </div>
        <div class="party">
          <h2>${doc.kind === "po" ? "Issued by" : "Bill to"}</h2>
          ${clientLines.length ? clientLines.map((l) => `<div>${esc(l)}</div>`).join("") : "<div>—</div>"}
          ${clientLegal.length ? `<div class="legal">${clientLegal.map(esc).join(" · ")}</div>` : ""}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="num" style="width: 60px;">Qty</th>
            <th class="num" style="width: 60px;">Unit</th>
            <th class="num" style="width: 110px;">Rate</th>
            <th class="num" style="width: 120px;">Amount</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
      </table>

      <div class="totals">
        <div class="line"><span>Subtotal</span><span>${fmt(doc.amount, doc.currency)}</span></div>
        ${doc.kind === "invoice" ? `
          <div class="line"><span>Paid to date</span><span>${fmt(doc.paid ?? 0, doc.currency)}</span></div>
          <div class="line grand"><span>Balance due</span><span class="due">${fmt(balance, doc.currency)}</span></div>
        ` : `
          <div class="line grand"><span>Total</span><span>${fmt(doc.amount, doc.currency)}</span></div>
        `}
      </div>

      ${doc.notes ? `<div class="notes"><strong>Notes</strong><div style="margin-top: 4px;">${esc(doc.notes)}</div></div>` : ""}
      ${doc.kind === "invoice" && bank.length ? `<div class="bank"><strong>Payment instructions</strong>${bank.map((l) => `<div>${esc(l)}</div>`).join("")}</div>` : ""}

      <div class="footer">
        ${doc.kind === "invoice"
          ? `Thank you for your business. Please reference ${esc(doc.number)} on any payment.`
          : doc.kind === "quote"
          ? `This quotation is valid until ${due ?? "—"}. Accept by issuing a purchase order referencing ${esc(doc.number)}.`
          : `Please confirm receipt of this purchase order and reference ${esc(doc.number)} on the corresponding invoice.`}
      </div>
    </div>
  `;
}

function buildPrintableDocument(args: { doc: DocumentData; company?: Company; client?: Client; project?: Project; showStatus?: boolean }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(args.doc.number)}</title>
    <style>@page { size: A4; margin: 22mm; } body { margin: 0; }</style>
    </head><body>${buildHTML(args)}</body></html>`;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
