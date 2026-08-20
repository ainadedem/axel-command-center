import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportTableCsv, exportTablePdf, type ExportColumn, type ExportRow } from "@/lib/table-export";

/**
 * Export control for list pages. The caller passes the columns exactly as
 * rendered (visible, in the user's order, with live widths) and the matching
 * rows, so the file always mirrors the table on screen.
 */
export function TableExportMenu({
  filename,
  title,
  subtitle,
  build,
  className,
  iconOnly = false,
}: {
  filename: string;
  title: string;
  subtitle?: string;
  build: () => { columns: ExportColumn[]; rows: ExportRow[] };
  className?: string;
  iconOnly?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const doCsv = () => {
    const { columns, rows } = build();
    exportTableCsv(`${filename}.csv`, columns, rows);
    toast.success(`Exported ${rows.length} row${rows.length !== 1 ? "s" : ""} to CSV`);
  };

  const doPdf = async () => {
    const { columns, rows } = build();
    setBusy(true);
    const t = toast.loading("Building PDF…");
    try {
      await exportTablePdf(`${filename}.pdf`, title, subtitle ?? `${rows.length} rows`, columns, rows);
      toast.success("PDF downloaded", { id: t });
    } catch (e) {
      toast.error(`Could not build the PDF: ${e instanceof Error ? e.message : String(e)}`, { id: t });

    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <button
            type="button"
            disabled={busy}
            title="Export"
            aria-label="Export"
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-full border-0 bg-surface text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50",
              className,
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
        ) : (
          <Button variant="outline" size="sm" className={className ?? "h-8 px-2.5 text-xs gap-1.5"} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Export current view</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onSelect={() => doCsv()}>
          <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs" onSelect={() => void doPdf()}>
          <FileText className="h-3.5 w-3.5 mr-2" /> PDF (landscape)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
          Uses the visible columns, their order and widths, plus the active filters and sort. Amounts export in full.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
