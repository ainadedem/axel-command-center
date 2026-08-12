import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Printer, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatRib, resolveBankAccount } from "@/lib/payment-details";
import { amountInFrench } from "@/lib/amount-words";
import { renderRichText } from "@/lib/rich-text";
import { useFileUrl } from "@/hooks/use-file-url";

import {
  fmt, type Company, type Client, type Project, type Currency, type QuoteLine,
} from "@/lib/mock-data";

export type DocKind = "invoice" | "po" | "quote";

export interface DocumentData {
  kind: DocKind;
  number: string;
  /** Short object / title printed under the document number. */
  subject?: string;
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
  /** Which company bank account to print in the payment details block. */
  bankAccountId?: string;
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
  const [showClientEmail, setShowClientEmail] = useState(true);
  const [showPayment, setShowPayment] = useState(company?.showPaymentDetails !== false);
  useEffect(() => { setShowPayment(company?.showPaymentDetails !== false); }, [company?.id, company?.showPaymentDetails]);

  // Logos are stored as private storage refs (`storage:bucket/path`) — resolve
  // them to a signed URL before embedding into the document HTML.
  const logoUrl = useFileUrl(company?.logoUrl);

  const [logoScale, setLogoScale] = useState(1);

  const html = useMemo(() => {
    if (!doc) return "";
    return buildHTML({ doc, company, client, project, showStatus, showPayment, showClientEmail, logoUrl, logoScale });
  }, [doc, company, client, project, showStatus, showPayment, showClientEmail, logoUrl, logoScale]);

  const printPdf = () => {
    if (!doc) return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(buildPrintableDocument({ doc, company, client, project, showStatus, showPayment, showClientEmail, logoUrl, logoScale }));
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
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox checked={showClientEmail} onCheckedChange={(v) => setShowClientEmail(!!v)} />
              Show client email
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox checked={showPayment} onCheckedChange={(v) => setShowPayment(!!v)} />
              Show payment details
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

function buildHTML({ doc, company, client, project, showStatus, showPayment, showClientEmail, logoUrl, logoScale }: DocumentHtmlArgs) {
  const rawColor = company?.color ?? "#1e293b";
  // Validate against a strict CSS color allowlist to prevent CSS/script injection
  // via the company.color field (it is embedded verbatim in a <style> block below).
  const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)|oklch\(\s*[\d.%\s]+\)|[a-zA-Z]{3,30})$/;
  const accent = SAFE_COLOR.test(rawColor.trim()) ? rawColor.trim() : "#1e293b";
  const issued = format(parseISO(doc.issueDate), "MMM d, yyyy");
  const due = doc.dueDate ? format(parseISO(doc.dueDate), "MMM d, yyyy") : null;
  const paidOn = doc.paidDate ? format(parseISO(doc.paidDate), "MMM d, yyyy") : null;
  const subtotalHT = doc.amount ?? 0;
  // Never invent VAT: only show tax when the document actually carries it.
  const vatRate = doc.taxRate ?? 0;
  const vatAmount = doc.taxAmount ?? subtotalHT * (vatRate / 100);
  const totalTTC = doc.totalAmount ?? subtotalHT + vatAmount;
  const balance = (doc.kind === "invoice" ? totalTTC : subtotalHT) - (doc.paid ?? 0);

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
  const poRef = (doc.references ?? []).find((r) => r.label.toUpperCase() === "PO")?.value;
  const taxMeta = [
    client?.nif && `NIF: ${client.nif}`,
    client?.stat && `STAT: ${client.stat}`,
    client?.rcs && `RCS: ${client.rcs}`,
    poRef && `PO Ref: ${poRef}`,
  ].filter(Boolean) as string[];
  const bank = resolveBankAccount(company, doc.bankAccountId);
  const rib = formatRib(bank?.bankCode, bank?.branchCode, bank?.accountNumber, bank?.ribKey);
  const wireLines = [
    bank?.bankName && `Bank: ${bank.bankName}`,
    (bank?.bankHolder || company?.legalName || company?.name) && `Account Name: ${bank?.bankHolder || company?.legalName || company?.name}`,
    rib ? `RIB: ${rib}` : bank?.bankAccount && `Account: ${bank.bankAccount}`,
    bank?.intlEnabled && bank?.bankSwift && `SWIFT/BIC: ${bank.bankSwift}`,
    bank?.intlEnabled && bank?.iban && `IBAN: ${bank.iban}`,
  ].filter(Boolean) as string[];
  const mobileLines = bank?.mobileEnabled
    ? ([
        bank?.mobileNumber && `Number: ${bank.mobileNumber}`,
        bank?.mobileName && `Name: ${bank.mobileName}`,
      ].filter(Boolean) as string[])
    : [];
  const paymentVisible = (showPayment ?? company?.showPaymentDetails !== false)
    && (wireLines.length > 0 || mobileLines.length > 0);
  const paymentHtml = paymentVisible
    ? `<div class="paycard">
        <h2 style="margin-bottom:10px;">Payment Terms &amp; Bank Details</h2>
        <div class="paygrid">
          ${wireLines.length ? `<div class="paycol">
            <div class="paytitle">Bank wire</div>
            ${wireLines.map((l) => `<div>${esc(l)}</div>`).join("")}
          </div>` : ""}
          ${mobileLines.length ? `<div class="paycol">
            <div class="paytitle"><span class="paybadge">${esc(bank?.mobileProvider ?? "Mobile money")}</span></div>
            ${mobileLines.map((l) => `<div>${esc(l)}</div>`).join("")}
          </div>` : ""}
        </div>
        <div class="payref">Please mention Invoice #${esc(doc.number)} as the transfer reference.</div>
      </div>`
    : "";

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
        const descHtml = esc(String(l.description ?? "").trim() || "—");
        const detailHtml = renderRichText(l.details);
        const meta = [l.capability, l.level].filter(Boolean).join(" · ");
        return `
          <tr>
            <td>
              <div class="rt" style="font-weight: 600;">${descHtml}</div>
              ${detailHtml
                ? `<div class="rt sub">${detailHtml}</div>`
                : meta ? `<div class="sub">${esc(meta)}</div>` : ""}
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

  const logoSrc = logoUrl && !logoUrl.startsWith("storage:") ? logoUrl : undefined;
  const sizeFactor = logoScale && logoScale > 0 ? logoScale : 1;
  const logoH = Math.round((company?.logoHeight ?? 52) * sizeFactor);
  const logoW = Math.round((company?.logoMaxWidth ?? 180) * sizeFactor);
  const logoHtml = logoSrc
    ? `<img src="${esc(logoSrc)}" alt="${esc(company?.name ?? "")}" style="max-height: ${logoH}px; max-width: ${logoW}px; object-fit: contain; margin-bottom: 12px;" />`
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
      .doc .taxmeta { margin-top: 8px; padding: 8px 10px; background: #f8fafc; border-left: 3px solid ${accent}; font-size: 10px; color: #475569; font-variant-numeric: tabular-nums; }
      .doc table { width: 100%; border-collapse: collapse; margin-top: 32px; font-size: 11px; table-layout: fixed; }
      .doc th { text-align: left; padding: 10px 8px; background: #f8fafc; border-bottom: 2px solid ${accent}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
      .doc td { padding: 12px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
      .doc .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .doc .sub { color: #64748b; font-size: 10px; margin-top: 3px; }
      .doc .rt { overflow-wrap: anywhere; }
      .doc .rt ul, .doc .rt ol { margin: 3px 0 0; padding-left: 16px; }
      .doc .rt li { margin: 1px 0; break-inside: avoid; page-break-inside: avoid; }
      .doc .rt div + div { margin-top: 3px; }
      @media print {
        .doc thead { display: table-header-group; }
        .doc tfoot { display: table-footer-group; }
        .doc tr { break-inside: avoid; page-break-inside: avoid; }
        .doc td, .doc th { break-inside: avoid; page-break-inside: avoid; }
        .doc .totals, .doc .paycard, .doc .notes, .doc .footer { break-inside: avoid; page-break-inside: avoid; }
      }

      .doc .totals { margin-top: 20px; margin-left: auto; width: 280px; font-size: 11px; }
      .doc .totals .line { display: flex; justify-content: space-between; padding: 6px 0; }
      .doc .totals .grand { border-top: 2px solid ${accent}; margin-top: 6px; padding-top: 10px; font-size: 14px; font-weight: 700; }
      .doc .totals .arrete { font-style: italic; color: #475569; font-size: 10px; margin: 8px 0 10px; padding-top: 6px; border-top: 1px dashed #cbd5e1; }
      .doc .totals .due { color: ${balance > 0 ? "#dc2626" : "#16a34a"}; font-weight: 700; }
      .doc .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; }
      .doc .paycard { margin-top: 28px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid ${accent}; font-size: 11px; }
      .doc .paygrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
      .doc .paycol div { margin-bottom: 2px; font-variant-numeric: tabular-nums; }
      .doc .paytitle { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; margin-bottom: 4px; }
      .doc .paybadge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: ${accent}; color: #fff; font-size: 9px; letter-spacing: 0.06em; }
      .doc .payref { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; color: #475569; font-size: 10px; }
      .doc .bank { margin-top: 16px; padding: 12px 16px; background: #f8fafc; border-left: 3px solid ${accent}; font-size: 11px; }
      .doc .notes { margin-top: 16px; padding: 12px 16px; background: #fffaf0; border-left: 3px solid #ca8a04; font-size: 11px; color: #475569; }
    </style>
    <div class="doc">
      <div class="row">
        <div>
          ${logoHtml}
          <h1>${headingFor(doc.kind)}</h1>
          <div style="margin-top: 8px; font-size: 13px; font-weight: 600;">${esc(doc.number)}</div>
          ${doc.subject ? `<div style="margin-top: 6px; font-size: 12px; color: #0f172a;"><strong>Object:</strong> ${esc(doc.subject)}</div>` : ""}
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
          <div style="font-weight: 700; font-size: 13px;">${esc(client?.name ?? "—")}</div>
          ${[client?.address, showClientEmail === false ? null : client?.email, client?.phone].filter(Boolean).map((l) => `<div>${esc(l as string)}</div>`).join("")}
          ${taxMeta.length ? `<div class="taxmeta">${taxMeta.map((l) => `<div>${esc(l)}</div>`).join("")}</div>` : ""}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="num" style="width: 70px;">Quantity</th>
            <th class="num" style="width: 60px;">Unit</th>
            <th class="num" style="width: 120px;">Unit Price HT</th>
            <th class="num" style="width: 130px;">Total HT</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
      </table>

      <div class="totals">
        <div class="line"><span>Subtotal HT</span><span>${fmt(subtotalHT, doc.currency)}</span></div>
        <div class="line"><span>TVA (${Number(vatRate).toFixed(2)}%)</span><span>${fmt(vatAmount, doc.currency)}</span></div>
        <div class="line grand"><span>Total TTC</span><span>${fmt(totalTTC, doc.currency)}</span></div>
        ${doc.kind === "invoice" || doc.kind === "quote" ? `
          <div class="arrete">Arrêté à la somme de ${esc(amountInFrench(totalTTC, doc.currency))}.</div>
        ` : ""}
        ${doc.kind === "invoice" ? `
          <div class="line"><span>Paid to date</span><span>${fmt(doc.paid ?? 0, doc.currency)}</span></div>
          <div class="line grand"><span>Balance due</span><span class="due">${fmt(balance, doc.currency)}</span></div>
        ` : ""}
      </div>

      ${doc.notes ? `<div class="notes"><strong>Notes</strong><div style="margin-top: 4px;">${esc(doc.notes)}</div></div>` : ""}
      ${paymentHtml}

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

export interface DocumentHtmlArgs {
  doc: DocumentData;
  company?: Company;
  client?: Client;
  project?: Project;
  showStatus?: boolean;
  showPayment?: boolean;
  showClientEmail?: boolean;
  /** Resolved (signed) company logo URL — storage refs must be resolved by the caller. */
  logoUrl?: string;
  /** Per-document multiplier applied to the company's logo size (1 = company default). */
  logoScale?: number;
}

export function buildPrintableDocument(args: DocumentHtmlArgs) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(args.doc.number)}</title>
    <style>@page { size: A4; margin: 22mm; } body { margin: 0; }</style>
    </head><body>${buildHTML(args)}</body></html>`;
}

export function buildDocumentHTML(args: DocumentHtmlArgs) {
  return buildHTML(args);
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
