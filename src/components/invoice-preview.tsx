import { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  fmt, type Invoice, type Company, type Client, type Project,
} from "@/lib/mock-data";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice | null;
  company?: Company;
  client?: Client;
  project?: Project;
}

/** Renders a print-ready A4 invoice. The "Export PDF" button uses the browser's
 *  native print-to-PDF — works in every modern browser, no extra dependencies. */
export function InvoicePreview({ open, onOpenChange, invoice, company, client, project }: Props) {
  const html = useMemo(() => {
    if (!invoice) return "";
    return buildInvoiceHTML({ invoice, company, client, project });
  }, [invoice, company, client, project]);

  const printPdf = () => {
    if (!invoice) return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(buildPrintableDocument({ invoice, company, client, project }));
    w.document.close();
    // Give the browser a tick to layout before invoking print.
    setTimeout(() => { w.focus(); w.print(); }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="text-sm font-medium">Invoice preview · {invoice?.number}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={printPdf}><Printer className="h-3.5 w-3.5 mr-1.5" />Print</Button>
            <Button size="sm" onClick={printPdf}><Download className="h-3.5 w-3.5 mr-1.5" />Export PDF</Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="overflow-y-auto bg-neutral-200 dark:bg-neutral-900 p-6 flex justify-center">
          <div
            className="bg-white text-neutral-900 shadow-xl"
            style={{ width: "210mm", minHeight: "297mm", padding: "16mm" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── HTML builders ─────────────────────────────────────────────────── */

function buildInvoiceHTML({ invoice, company, client, project }: { invoice: Invoice; company?: Company; client?: Client; project?: Project }) {
  const balance = invoice.amount - invoice.paid;
  const issued = format(parseISO(invoice.issueDate), "MMM d, yyyy");
  const due = format(parseISO(invoice.dueDate), "MMM d, yyyy");
  const paidOn = invoice.paidDate ? format(parseISO(invoice.paidDate), "MMM d, yyyy") : null;
  const accent = company?.color ?? "#1e293b";

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
    client?.name,
    client?.address,
    client?.email,
    client?.phone,
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
    draft: "#71717a", sent: "#0891b2", partial: "#ca8a04", paid: "#16a34a", overdue: "#dc2626",
  };

  return `
    <style>
      .inv { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.5; }
      .inv h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: ${accent}; }
      .inv h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; margin: 0 0 6px; font-weight: 600; }
      .inv .row { display: flex; justify-content: space-between; align-items: flex-start; }
      .inv .meta { text-align: right; font-size: 11px; }
      .inv .pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: white; background: ${statusColors[invoice.status] ?? "#475569"}; }
      .inv .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 28px; }
      .inv .party { font-size: 11px; }
      .inv .party div { margin-bottom: 2px; }
      .inv .legal { margin-top: 6px; color: #64748b; font-size: 10px; }
      .inv table { width: 100%; border-collapse: collapse; margin-top: 32px; font-size: 11px; }
      .inv th { text-align: left; padding: 10px 8px; background: #f8fafc; border-bottom: 2px solid ${accent}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
      .inv td { padding: 12px 8px; border-bottom: 1px solid #e2e8f0; }
      .inv .num { text-align: right; font-variant-numeric: tabular-nums; }
      .inv .totals { margin-top: 20px; margin-left: auto; width: 280px; font-size: 11px; }
      .inv .totals .line { display: flex; justify-content: space-between; padding: 6px 0; }
      .inv .totals .grand { border-top: 2px solid ${accent}; margin-top: 6px; padding-top: 10px; font-size: 14px; font-weight: 700; }
      .inv .totals .due { color: ${balance > 0 ? "#dc2626" : "#16a34a"}; font-weight: 700; }
      .inv .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; }
      .inv .bank { margin-top: 16px; padding: 12px 16px; background: #f8fafc; border-left: 3px solid ${accent}; font-size: 11px; }
      .inv .bank div { margin-bottom: 2px; }
    </style>
    <div class="inv">
      <div class="row">
        <div>
          <h1>INVOICE</h1>
          <div style="margin-top: 8px; font-size: 13px; font-weight: 600;">${esc(invoice.number)}</div>
        </div>
        <div class="meta">
          <div class="pill">${invoice.status}</div>
          <div style="margin-top: 10px;"><strong>Issued:</strong> ${issued}</div>
          <div><strong>Due:</strong> ${due}</div>
          ${paidOn ? `<div><strong>Paid:</strong> ${paidOn}</div>` : ""}
        </div>
      </div>

      <div class="grid">
        <div class="party">
          <h2>From</h2>
          ${companyLines.map((l) => `<div>${esc(l)}</div>`).join("")}
          ${companyLegal.length ? `<div class="legal">${companyLegal.map(esc).join(" · ")}</div>` : ""}
        </div>
        <div class="party">
          <h2>Bill to</h2>
          ${clientLines.length ? clientLines.map((l) => `<div>${esc(l)}</div>`).join("") : "<div>—</div>"}
          ${clientLegal.length ? `<div class="legal">${clientLegal.map(esc).join(" · ")}</div>` : ""}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="num" style="width: 120px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div style="font-weight: 600;">${esc(project?.name ?? "Professional services")}</div>
              ${project ? `<div style="color: #64748b; font-size: 10px; margin-top: 2px;">Project · ${esc(project.name)}</div>` : ""}
            </td>
            <td class="num">${fmt(invoice.amount, invoice.currency)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="line"><span>Subtotal</span><span>${fmt(invoice.amount, invoice.currency)}</span></div>
        <div class="line"><span>Paid to date</span><span>${fmt(invoice.paid, invoice.currency)}</span></div>
        <div class="line grand"><span>Balance due</span><span class="due">${fmt(balance, invoice.currency)}</span></div>
      </div>

      ${bank.length ? `<div class="bank"><strong>Payment instructions</strong>${bank.map((l) => `<div>${esc(l)}</div>`).join("")}</div>` : ""}

      <div class="footer">
        Thank you for your business. Please reference invoice <strong>${esc(invoice.number)}</strong> on any payment.
      </div>
    </div>
  `;
}

function buildPrintableDocument(args: { invoice: Invoice; company?: Company; client?: Client; project?: Project }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(args.invoice.number)}</title>
    <style>@page { size: A4; margin: 16mm; } body { margin: 0; }</style>
    </head><body>${buildInvoiceHTML(args)}</body></html>`;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
