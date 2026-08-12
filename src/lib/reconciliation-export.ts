import html2pdf from "html2pdf.js";
import { exportCsvRows } from "@/lib/export-csv";

export interface ReconciliationLine {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  matched?: string;
  included: boolean;
  duplicate?: boolean;
}

export interface ReconciliationSummary {
  companyName?: string;
  accountName: string;
  currency: string;
  statementName?: string;
  createdAt: string;
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  openingBalanceDate?: string;
  ledgerBefore?: number;
  movements?: number;
  expectedClosing: number;
  statementClosing: number;
  difference: number;
  adjustmentAmount?: number;
  rowCount: number;
  lines?: ReconciliationLine[];
}

const num = (n: number | undefined) =>
  n === undefined || n === null || isNaN(n) ? "" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const money = (n: number | undefined, ccy: string) => (n === undefined ? "—" : `${num(n)} ${ccy}`);

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "account";
}

export function reconciliationFileBase(s: ReconciliationSummary) {
  const period = s.periodEnd ?? s.createdAt.slice(0, 10);
  return `reconciliation-${slug(s.accountName)}-${period}`;
}

/* ─── CSV ───────────────────────────────────────────────────────────── */

export function exportReconciliationCsv(s: ReconciliationSummary) {
  const rows: (string | number)[][] = [
    ["Company", s.companyName ?? ""],
    ["Account", s.accountName],
    ["Currency", s.currency],
    ["Statement file", s.statementName ?? ""],
    ["Reconciled on", s.createdAt.slice(0, 10)],
    ["Period start", s.periodStart ?? ""],
    ["Period end", s.periodEnd ?? ""],
    [],
    ["Opening balance", num(s.openingBalance)],
    ["Opening balance date", s.openingBalanceDate ?? ""],
    ["Ledger balance before import", num(s.ledgerBefore)],
    ["Statement movements", num(s.movements)],
    ["Rows imported", s.rowCount],
    ["Expected closing balance", num(s.expectedClosing)],
    ["Bank statement closing balance", num(s.statementClosing)],
    ["Difference", num(s.difference)],
    ["Adjustment posted", s.adjustmentAmount ? num(s.adjustmentAmount) : "none"],
    ["Status", Math.abs(s.difference) < 1 ? "Balanced" : s.adjustmentAmount ? "Adjusted" : "Difference"],
  ];

  if (s.lines?.length) {
    rows.push([]);
    rows.push(["Date", "Description", "Type", "Amount", "Matched invoice", "Imported"]);
    for (const l of s.lines) {
      rows.push([
        l.date,
        l.description,
        l.type === "income" ? "Credit" : "Debit",
        num(l.type === "income" ? l.amount : -l.amount),
        l.matched ?? "",
        l.included ? "yes" : l.duplicate ? "skipped (already in ledger)" : "excluded",
      ]);
    }
  }

  exportCsvRows(`${reconciliationFileBase(s)}.csv`, ["Reconciliation summary", ""], rows);
}

/* ─── PDF ───────────────────────────────────────────────────────────── */

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function summaryHtml(s: ReconciliationSummary) {
  const balanced = Math.abs(s.difference) < 1;
  const status = balanced ? "Balanced" : s.adjustmentAmount ? "Adjusted" : "Difference";
  const statusColor = balanced ? "#127c4a" : s.adjustmentAmount ? "#8a6100" : "#b3261e";

  const row = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:6px 0;color:#555;font-size:11px;">${esc(label)}</td>
      <td style="padding:6px 0;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;${bold ? "font-weight:700;" : ""}">${esc(value)}</td>
    </tr>`;

  const lines = (s.lines ?? []).filter((l) => l.included);
  const linesHtml = lines.length
    ? `
    <h3 style="margin:22px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#2563EB;">Reconciled items (${lines.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead>
        <tr style="border-bottom:1px solid #ddd;color:#666;text-align:left;">
          <th style="padding:5px 4px;font-weight:600;">Date</th>
          <th style="padding:5px 4px;font-weight:600;">Description</th>
          <th style="padding:5px 4px;font-weight:600;">Matched</th>
          <th style="padding:5px 4px;font-weight:600;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((l) => `
          <tr style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:4px;white-space:nowrap;">${esc(l.date)}</td>
            <td style="padding:4px;">${esc(l.description).slice(0, 70)}</td>
            <td style="padding:4px;color:#127c4a;">${esc(l.matched ?? "")}</td>
            <td style="padding:4px;text-align:right;font-variant-numeric:tabular-nums;color:${l.type === "income" ? "#127c4a" : "#b3261e"};">
              ${l.type === "income" ? "+" : "−"}${esc(num(l.amount))}
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`
    : "";

  return `
  <div style="font-family:Helvetica,Arial,sans-serif;color:#111;padding:32px;width:720px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563EB;padding-bottom:12px;">
      <div>
        <div style="font-size:18px;font-weight:700;">${esc(s.companyName ?? "")}</div>
        <div style="font-size:12px;color:#555;margin-top:2px;">Bank reconciliation summary</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#555;">
        <div><strong style="color:#111;">${esc(s.accountName)}</strong></div>
        <div>${esc(s.currency)}</div>
        <div>Reconciled ${esc(s.createdAt.slice(0, 10))}</div>
      </div>
    </div>

    <div style="margin-top:16px;display:flex;gap:24px;font-size:11px;color:#555;">
      <div><span style="color:#888;">Period</span><br/><strong style="color:#111;">${esc(s.periodStart ?? "—")} → ${esc(s.periodEnd ?? "—")}</strong></div>
      <div><span style="color:#888;">Statement file</span><br/><strong style="color:#111;">${esc(s.statementName ?? "—")}</strong></div>
      <div><span style="color:#888;">Status</span><br/><strong style="color:${statusColor};">${status}</strong></div>
    </div>

    <h3 style="margin:22px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#2563EB;">Balance reconciliation</h3>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;">
      ${row(`Opening balance${s.openingBalanceDate ? ` (as of ${s.openingBalanceDate})` : ""}`, money(s.openingBalance, s.currency))}
      ${s.ledgerBefore !== undefined ? row("Ledger balance before import", money(s.ledgerBefore, s.currency)) : ""}
      ${row(`Statement movements (${s.rowCount} rows)`, money(s.movements, s.currency))}
      ${row("Expected closing balance", money(s.expectedClosing, s.currency), true)}
      ${row("Bank statement closing balance", money(s.statementClosing, s.currency), true)}
      ${s.adjustmentAmount ? row("Balancing adjustment posted", money(s.adjustmentAmount, s.currency)) : ""}
    </table>

    <div style="margin-top:10px;padding:10px 12px;border-radius:8px;background:${balanced ? "#eaf7f0" : "#fdecea"};display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:${statusColor};">
      <span>${balanced ? "Reconciled — matches the bank" : "Difference vs bank"}</span>
      <span style="font-variant-numeric:tabular-nums;">${esc(money(s.difference, s.currency))}</span>
    </div>

    ${linesHtml}

    <div style="margin-top:26px;font-size:9px;color:#999;border-top:1px solid #eee;padding-top:8px;">
      Generated by Axel Business Platform ® — The Axiom Winford Group
    </div>
  </div>`;
}

export async function exportReconciliationPdf(s: ReconciliationSummary) {
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.background = "#fff";
  holder.innerHTML = summaryHtml(s);
  document.body.appendChild(holder);
  try {
    await (html2pdf as unknown as () => {
      set: (o: unknown) => { from: (el: HTMLElement) => { save: () => Promise<void> } };
    })()
      .set({
        margin: 0,
        filename: `${reconciliationFileBase(s)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: "#ffffff" },
        jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
      })
      .from(holder.firstElementChild as HTMLElement)
      .save();
  } finally {
    document.body.removeChild(holder);
  }
}
