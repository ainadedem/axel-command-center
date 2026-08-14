/**
 * Table exports (CSV + PDF) that mirror exactly what the user sees:
 * the visible columns, in the current order, at proportional widths,
 * with the current filters / sort / search already applied by the caller.
 */
import { exportCsvRows } from "@/lib/export-csv";

export type ExportColumn = {
  key: string;
  label: string;
  /** On-screen width in px — used to keep PDF proportions identical. */
  width: number;
  align?: "left" | "right" | "center";
};

export type ExportRow = Record<string, string>;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function exportTableCsv(filename: string, columns: ExportColumn[], rows: ExportRow[]) {
  exportCsvRows(
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
    columns.map((c) => c.label),
    rows.map((r) => columns.map((c) => r[c.key] ?? "")),
  );
}

type Html2PdfWorker = {
  set: (o: unknown) => Html2PdfWorker;
  from: (el: HTMLElement) => Html2PdfWorker;
  outputPdf: (t: string) => Promise<Blob>;
};

function tableHtml(title: string, subtitle: string, columns: ExportColumn[], rows: ExportRow[]) {
  const total = columns.reduce((s, c) => s + c.width, 0) || 1;
  const head = columns
    .map(
      (c) =>
        `<th style="width:${((c.width / total) * 100).toFixed(2)}%;text-align:${c.align ?? "left"}">${esc(c.label)}</th>`,
    )
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${columns
          .map((c) => `<td style="text-align:${c.align ?? "left"}">${esc(r[c.key] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<div class="sheet">
  <style>
    .sheet { font-family: 'Inter', system-ui, sans-serif; color:#1F1F1F; padding:12mm 10mm; box-sizing:border-box; }
    .sheet h1 { font-family:'Plus Jakarta Sans', system-ui, sans-serif; font-size:16pt; margin:0 0 2mm; letter-spacing:-0.01em; }
    .sheet .sub { font-size:8pt; color:#5F6368; margin:0 0 6mm; }
    .sheet table { width:100%; border-collapse:collapse; table-layout:fixed; }
    .sheet th { font-family:'Plus Jakarta Sans', system-ui, sans-serif; font-size:7.5pt; text-transform:uppercase; letter-spacing:0.06em;
      color:#5F6368; border-bottom:1px solid #C9CCD1; padding:2.5mm 2mm; }
    .sheet td { font-size:8pt; padding:2.2mm 2mm; border-bottom:1px solid #E8EAED; word-wrap:break-word; overflow-wrap:anywhere; }
    .sheet tr { page-break-inside: avoid; }
  </style>
  <h1>${esc(title)}</h1>
  <p class="sub">${esc(subtitle)}</p>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</div>`;
}

export async function exportTablePdf(
  filename: string,
  title: string,
  subtitle: string,
  columns: ExportColumn[],
  rows: ExportRow[],
) {
  const mod = await import("html2pdf.js");
  const html2pdf = (mod as unknown as { default: () => Html2PdfWorker }).default;

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-10000px;top:0;width:297mm;background:#ffffff;";
  container.innerHTML = tableHtml(title, subtitle, columns, rows);
  document.body.appendChild(container);
  try {
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
    }
    const blob = await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr"] },
      })
      .from(container)
      .outputPdf("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    container.remove();
  }
}
