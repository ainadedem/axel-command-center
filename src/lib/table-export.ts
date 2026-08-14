/**
 * Table exports (CSV + PDF) that mirror exactly what the user sees:
 * the visible columns, in the current order, at proportional widths,
 * with the current filters / sort / search already applied by the caller.
 */
import { exportCsvRows } from "@/lib/export-csv";
import { renderHtmlToPdfBlob, saveBlob, printHtmlFallback } from "@/lib/pdf-render";

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

function tableHtml(title: string, subtitle: string, columns: ExportColumn[], rows: ExportRow[]) {
  // Numeric (right-aligned) columns get a floor so full amounts never collide
  // with the neighbouring column when the on-screen width is tight.
  const raw = columns.map((c) => (c.align === "right" ? Math.max(c.width, 130) : c.width));
  const total = raw.reduce((s, w) => s + w, 0) || 1;
  const head = columns
    .map(
      (c, i) =>
        `<th style="width:${((raw[i]! / total) * 100).toFixed(2)}%;text-align:${c.align ?? "left"}">${esc(c.label)}</th>`,
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
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 0; }
  html, body { margin:0; padding:0; background:#ffffff; }
  .sheet { font-family: 'Inter', system-ui, sans-serif; color:#1F1F1F; padding:12mm 10mm; box-sizing:border-box;
    width:297mm; min-height:210mm; background:#ffffff; }
  .sheet h1 { font-family:'Plus Jakarta Sans', system-ui, sans-serif; font-size:16pt; margin:0 0 2mm; letter-spacing:-0.01em; }
  .sheet .sub { font-size:8pt; color:#5F6368; margin:0 0 6mm; }
  .sheet table { width:100%; border-collapse:collapse; table-layout:fixed; }
  .sheet th { font-family:'Plus Jakarta Sans', system-ui, sans-serif; font-size:7.5pt; text-transform:uppercase; letter-spacing:0.06em;
    color:#5F6368; border-bottom:1px solid #C9CCD1; padding:2.5mm 2mm; }
  .sheet td { font-size:8pt; padding:2.2mm 2mm; border-bottom:1px solid #E8EAED; word-wrap:break-word; overflow-wrap:anywhere; }
  .sheet tr { page-break-inside: avoid; }
</style></head><body><div class="sheet">
  <h1>${esc(title)}</h1>
  <p class="sub">${esc(subtitle)}</p>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</div></body></html>`;
}

export async function exportTablePdf(
  filename: string,
  title: string,
  subtitle: string,
  columns: ExportColumn[],
  rows: ExportRow[],
) {
  const html = tableHtml(title, subtitle, columns, rows);
  const name = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  try {
    const blob = await renderHtmlToPdfBlob(html, { orientation: "landscape", scale: 2, avoidBreakSelector: "tr" });
    saveBlob(blob, name);
  } catch (err) {
    printHtmlFallback(html);
    throw err instanceof Error ? err : new Error("PDF export failed");
  }
}

