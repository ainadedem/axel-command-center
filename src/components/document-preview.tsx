import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EXPORT_FONT_LINKS, EXPORT_TYPOGRAPHY_CSS } from "@/lib/export-fonts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Printer, X, ZoomIn, ZoomOut, Maximize2, Loader2, AlertTriangle, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { formatRib, resolveBankAccount } from "@/lib/payment-details";
import { amountInFrench } from "@/lib/amount-words";
import { renderRichText } from "@/lib/rich-text";
import { useFileUrl } from "@/hooks/use-file-url";
import { useSigner } from "@/hooks/use-signer";
import { docLabels, docDateFormat, DOC_LANGUAGES, type DocLanguage } from "@/lib/doc-i18n";
import { exportDocumentPdf, pdfFilename, type ExportStage } from "@/lib/pdf-export";
import { measureHtmlPages } from "@/lib/pdf-render";
import { describePlacement, logStampChange, logSignerChange, type DocType } from "@/lib/document-activity";



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
  /** Document-wide sales discount in percent, applied before tax. */
  discountPct?: number;
  /** Tax breakdown (used on quotes). */
  taxRate?: number;
  taxAmount?: number;
  totalAmount?: number;
  /** Which company bank account to print in the payment details block. */
  bankAccountId?: string;
  /** Printed language of the document ("en" | "fr"). */
  language?: DocLanguage;
  /** User id whose signature is printed (last editor, else creator). */
  signerId?: string;
  /** Custom stamp placement, in percent of the page (top-left origin). */
  stampX?: number;
  stampY?: number;
  /** Stamp size multiplier relative to the company default width. */
  stampScale?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: DocumentData | null;
  company?: Company;
  client?: Client;
  project?: Project;
  /** People who can sign this document (used by the signer picker). */
  signers?: Array<{ userId: string; name: string }>;
  /** Persist per-document signer / stamp placement changes. */
  onDocChange?: (patch: {
    signerId?: string;
    stampX?: number;
    stampY?: number;
    stampScale?: number;
    stampDirty?: boolean;
  }) => void;
  /** Identifies the document so stamp/signer changes are written to the audit trail. */
  audit?: { docType: DocType; docId: string; companyId: string };
}


const MM = 96 / 25.4;

const EXPORT_LABEL: Record<ExportStage, string> = {
  preparing: "Preparing…",
  rendering: "Rendering…",
  saving: "Saving…",
  done: "Done",
};

const SHEET_W = 210 * MM;
const SHEET_H = 297 * MM;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const VIEW_KEY = "axel:doc-preview:view";

export type ColKey = "desc" | "qty" | "unit" | "rate" | "total";
export type ColWidths = Partial<Record<ColKey, number>>;
export type Density = "auto" | "compact" | "normal" | "spacious" | "manual";

const DEFAULT_COLS: Record<ColKey, number> = { desc: 46, qty: 8, unit: 10, rate: 18, total: 18 };
const DENSITY_SCALE: Record<Exclude<Density, "auto" | "manual">, number> = { compact: 0.85, normal: 1, spacious: 1.12 };

/** Default "force one A4 page" preference per document type. */
const DEFAULT_FIT_ONE_PAGE: Record<DocKind, boolean> = { invoice: true, quote: true, po: true };

type ZoomMode = "fit" | "actual" | "custom";
type SavedView = {
  zoom: number; mode: ZoomMode; scrollTop: number; scrollLeft: number;
  colWidths?: ColWidths; density?: Density; fitOnePage?: boolean; manualScale?: number;
  showStamp?: boolean; showSignature?: boolean;
};



const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Visible column keys in print order. */
function visibleCols(showUnit: boolean): ColKey[] {
  return showUnit ? ["desc", "qty", "unit", "rate", "total"] : ["desc", "qty", "rate", "total"];
}

/** Normalise the stored widths to the currently visible columns, summing to 100%. */
export function normalizeCols(widths: ColWidths | undefined, showUnit: boolean): Record<ColKey, number> {
  const keys = visibleCols(showUnit);
  const raw = keys.map((k) => Math.max(4, widths?.[k] ?? DEFAULT_COLS[k]));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const out = {} as Record<ColKey, number>;
  keys.forEach((k, i) => { out[k] = (raw[i] / sum) * 100; });
  return out;
}



function loadView(kind?: DocKind): SavedView | null {
  if (typeof window === "undefined" || !kind) return null;
  try {
    const all = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}") as Record<string, SavedView>;
    const v = all[kind];
    if (!v || typeof v.zoom !== "number") return null;
    return { ...v, zoom: clamp(v.zoom, MIN_ZOOM, MAX_ZOOM) };
  } catch { return null; }
}

function saveView(kind: DocKind, v: SavedView) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}") as Record<string, SavedView>;
    all[kind] = v;
    localStorage.setItem(VIEW_KEY, JSON.stringify(all));
  } catch { /* storage unavailable — non-fatal */ }
}

export function DocumentPreview({ open, onOpenChange, doc, company, client, project, signers, onDocChange, audit }: Props) {
  const [showStatus, setShowStatus] = useState(true);
  const [showClientEmail, setShowClientEmail] = useState(true);
  const [showUnit, setShowUnit] = useState(true);
  const [showPayment, setShowPayment] = useState(company?.showPaymentDetails !== false);
  useEffect(() => { setShowPayment(company?.showPaymentDetails !== false); }, [company?.id, company?.showPaymentDetails]);

  // Stamp / signature ------------------------------------------------------
  const [showStamp, setShowStamp] = useState(company?.showStamp === true);
  const [showSignature, setShowSignature] = useState(true);
  useEffect(() => { setShowStamp(company?.showStamp === true); }, [company?.id, company?.showStamp]);

  // Per-document signer: defaults to whatever the document stores.
  const [signerId, setSignerId] = useState<string | undefined>(doc?.signerId);
  useEffect(() => { setSignerId(doc?.signerId); }, [doc?.signerId]);
  const signer = useSigner(signerId);

  // Custom stamp placement (percent of the page, top-left origin).
  const [place, setPlace] = useState<{ x?: number; y?: number; scale?: number }>({});
  useEffect(() => {
    setPlace({ x: doc?.stampX, y: doc?.stampY, scale: doc?.stampScale });
  }, [doc?.number, doc?.stampX, doc?.stampY, doc?.stampScale]);
  const floating = place.x != null && place.y != null;
  const stampUrl = useFileUrl(company?.stampUrl);
  const signatureUrl = useFileUrl(signer.signatureRef);

  // Logos are stored as private storage refs (`storage:bucket/path`) — resolve
  // them to a signed URL before embedding into the document HTML.
  const logoUrl = useFileUrl(company?.logoUrl);

  const [logoScale, setLogoScale] = useState(1);
  const [lang, setLang] = useState<DocLanguage>(doc?.language ?? (company?.defaultDocumentLanguage as DocLanguage) ?? "en");
  useEffect(() => {
    setLang(doc?.language ?? (company?.defaultDocumentLanguage as DocLanguage) ?? "en");
  }, [doc?.number, doc?.language, company?.id, company?.defaultDocumentLanguage]);

  // ---- Column widths / density -------------------------------------------
  const [colWidths, setColWidths] = useState<ColWidths>({});
  const [density, setDensity] = useState<Density>("auto");
  const [fitOnePage, setFitOnePage] = useState(true);
  const [manualScale, setManualScale] = useState(1);
  const [autoScale, setAutoScale] = useState(1);
  const [pages, setPages] = useState(1);
  /** Set when the exporter had to shrink the document to reach one page. */
  const [compression, setCompression] = useState<{ scale: number; fits: boolean } | null>(null);
  const cols = useMemo(() => normalizeCols(colWidths, showUnit), [colWidths, showUnit]);
  const scale =
    density === "auto" ? autoScale : density === "manual" ? manualScale : DENSITY_SCALE[density];



  // ---- Zoom / fit ---------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetH, setSheetH] = useState(SHEET_H);

  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<ZoomMode>("fit");
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const restoredRef = useRef(false);

  const fitZoom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return 1;
    const pad = 48; // p-6 both sides
    return clamp((el.clientWidth - pad) / SHEET_W, MIN_ZOOM, MAX_ZOOM);
  }, []);

  // Restore the saved view whenever the dialog opens.
  useEffect(() => {
    if (!open) { restoredRef.current = false; return; }
    const saved = loadView(doc?.kind);
    setMode(saved?.mode ?? "fit");
    setZoom(saved?.mode === "fit" || !saved ? 1 : saved.zoom);
    setColWidths(saved?.colWidths ?? {});
    setDensity(saved?.density ?? "auto");
    setFitOnePage(saved?.fitOnePage ?? true);
    setShowStamp(saved?.showStamp ?? company?.showStamp === true);
    setShowSignature(saved?.showSignature ?? true);

    const id = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!saved || saved.mode === "fit") setZoom(fitZoom());
      if (el && saved) { el.scrollTop = saved.scrollTop ?? 0; el.scrollLeft = saved.scrollLeft ?? 0; }
      restoredRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [open, doc?.kind, fitZoom, company?.showStamp]);

  // Keep fit mode in sync with the container size.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !open) return;
    const ro = new ResizeObserver(() => { if (mode === "fit") setZoom(fitZoom()); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, mode, fitZoom]);

  // Persist zoom + scroll position.
  useEffect(() => {
    if (!open || !doc?.kind || !restoredRef.current) return;
    const el = scrollRef.current;
    const kind = doc.kind;
    const persist = () => saveView(kind, {
      zoom: zoomRef.current, mode,
      scrollTop: el?.scrollTop ?? 0, scrollLeft: el?.scrollLeft ?? 0,
      colWidths, density, fitOnePage, showStamp, showSignature,
    });
    const t = setInterval(persist, 1000);
    return () => { clearInterval(t); persist(); };
  }, [open, doc?.kind, mode, zoom, colWidths, density, fitOnePage, showStamp, showSignature]);


  const applyZoom = useCallback((next: number, anchor?: { x: number; y: number }) => {
    const el = scrollRef.current;
    const clamped = clamp(next, MIN_ZOOM, MAX_ZOOM);
    if (el) {
      const k = clamped / zoomRef.current;
      const px = (anchor?.x ?? el.clientWidth / 2) + el.scrollLeft;
      const py = (anchor?.y ?? el.clientHeight / 2) + el.scrollTop;
      requestAnimationFrame(() => {
        el.scrollLeft = px * k - (anchor?.x ?? el.clientWidth / 2);
        el.scrollTop = py * k - (anchor?.y ?? el.clientHeight / 2);
      });
    }
    zoomRef.current = clamped;
    setZoom(clamped);
    setMode(Math.abs(clamped - 1) < 0.005 ? "actual" : "custom");
  }, []);

  const applyZoomRef = useRef(applyZoom);
  applyZoomRef.current = applyZoom;

  // Ctrl/Cmd + wheel (and trackpad pinch) zoom — needs a non-passive listener.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const rect = el.getBoundingClientRect();
      applyZoomRef.current(zoomRef.current * Math.exp(-dy * 0.0015), {
        x: e.clientX - rect.left, y: e.clientY - rect.top,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  const setFit = () => { setMode("fit"); const z = fitZoom(); zoomRef.current = z; setZoom(z); };
  const setActual = () => { setMode("actual"); zoomRef.current = 1; setZoom(1); };

  const html = useMemo(() => {
    if (!doc) return "";
    return buildHTML({ doc, company, client, project, showStatus, showPayment, showClientEmail, showUnit, logoUrl, logoScale, lang, cols, scale, showStamp, stampUrl, showSignature, signatureUrl, signerName: signer.name, stampX: place.x, stampY: place.y, stampScale: place.scale });
  }, [doc, company, client, project, showStatus, showPayment, showClientEmail, showUnit, logoUrl, logoScale, lang, cols, scale, showStamp, stampUrl, showSignature, signatureUrl, signer.name, place]);

  // Reset the auto-fit search whenever the document content changes.
  useEffect(() => {
    setAutoScale(1);
  }, [doc?.number, showUnit, showPayment, showClientEmail, showStatus, lang, logoScale, colWidths, density, open]);

  // Track the real (unscaled) sheet height, the page count, and step the
  // auto-fit scale down until the document fits a single A4 page.
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el || !open) return;
    const measure = () => {
      const h = el.scrollHeight;
      setSheetH(Math.max(SHEET_H, el.offsetHeight));
      const contentH = Math.max(0, h - PAGE_PAD_MM * 2 * MM);
      const p = Math.max(1, Math.ceil((contentH - 2) / USABLE_H));
      setPages(p);
      if (density === "auto" && p > 1 && autoScale > MIN_AUTO_SCALE) {
        setAutoScale((s) => Math.max(MIN_AUTO_SCALE, Math.round((s - 0.05) * 1000) / 1000));
      }
    };
    const id = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, [open, html, density, autoScale]);

  // ---- Column resizing (drag the header borders) --------------------------
  const [handles, setHandles] = useState<Array<{ key: ColKey; x: number; top: number; height: number }>>([]);
  const colsRef = useRef(cols);
  colsRef.current = cols;

  const measureHandles = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet) { setHandles([]); return; }
    const table = sheet.querySelector("table");
    const ths = table?.querySelectorAll("thead th");
    if (!table || !ths || ths.length < 2) { setHandles([]); return; }
    const base = sheet.getBoundingClientRect();
    const tRect = table.getBoundingClientRect();
    const keys = visibleCols(showUnit);
    const next: Array<{ key: ColKey; x: number; top: number; height: number }> = [];
    ths.forEach((th, i) => {
      if (i >= ths.length - 1) return; // no handle after the last column
      const r = (th as HTMLElement).getBoundingClientRect();
      next.push({
        key: keys[i],
        x: r.right - base.left,
        top: tRect.top - base.top,
        height: Math.max(24, tRect.height),
      });
    });
    setHandles(next);
  }, [showUnit]);

  useLayoutEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(measureHandles);
    return () => cancelAnimationFrame(id);
  }, [open, html, zoom, measureHandles]);

  const startColDrag = (key: ColKey) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sheet = sheetRef.current;
    const table = sheet?.querySelector("table") as HTMLElement | null;
    if (!table) return;
    const tableW = table.getBoundingClientRect().width || 1;
    const startX = e.clientX;
    const keys = visibleCols(showUnit);
    const idx = keys.indexOf(key);
    const nextKey = keys[idx + 1];
    if (!nextKey) return;
    const start = { ...colsRef.current };
    const onMove = (ev: PointerEvent) => {
      const deltaPct = ((ev.clientX - startX) / tableW) * 100;
      const d = clamp(deltaPct, -(start[key] - 5), start[nextKey] - 5);
      setColWidths({ ...start, [key]: start[key] + d, [nextKey]: start[nextKey] - d });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };




  // ---- Export -------------------------------------------------------------
  const [exporting, setExporting] = useState(false);
  const [exportStage, setExportStage] = useState<ExportStage | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);


  const printableHtml = useCallback((scaleOverride?: number) => {
    if (!doc) return "";
    return buildPrintableDocument({
      doc, company, client, project, showStatus, showPayment, showClientEmail, showUnit,
      logoUrl, logoScale, lang, cols, scale: scaleOverride ?? scale, showStamp, stampUrl, showSignature, signatureUrl,
      signerName: signer.name, stampX: place.x, stampY: place.y, stampScale: place.scale,
    });
  }, [doc, company, client, project, showStatus, showPayment, showClientEmail, showUnit, logoUrl, logoScale, lang, cols, scale, showStamp, stampUrl, showSignature, signatureUrl, signer.name, place]);

  const downloadPdf = useCallback(async () => {
    if (!doc || exporting) return;
    setExportError(null);
    setExporting(true);
    setExportStage("preparing");
    const filename = pdfFilename(doc.number);
    try {
      let html = printableHtml();
      let usedScale = scale;
      let compressed = false;
      if (fitOnePage) {
        setExportStage("preparing");
        // Verify against the real export pipeline; the offscreen frame can lay
        // out a hair taller than the on-screen sheet.
        let pagesNow = await measureHtmlPages(html);
        while (pagesNow > 1 && usedScale > EXPORT_MIN_SCALE) {
          usedScale = Math.max(EXPORT_MIN_SCALE, Math.round((usedScale - 0.05) * 1000) / 1000);
          html = printableHtml(usedScale);
          pagesNow = await measureHtmlPages(html);
          compressed = true;
        }
        if (pagesNow > 1) compressed = true;
      }
      await exportDocumentPdf(html, filename, setExportStage, { onePage: fitOnePage });
      toast.success(
        compressed ? `Downloaded ${filename} — compressed to fit one page` : `Downloaded ${filename}`,
      );
    } catch (e) {
      const msg = `PDF export failed: ${e instanceof Error ? e.message : String(e)}`;
      setExportError(msg);
      toast.error(msg);
    } finally {
      setExporting(false);
      setExportStage(null);
    }
  }, [doc, exporting, printableHtml, fitOnePage, scale]);

  const printPdf = () => {
    if (!doc || exporting) return;
    setExportError(null);
    setExporting(true);
    try {
      const w = window.open("", "_blank", "width=900,height=1100");
      if (!w) {
        const msg = "Pop-ups are blocked — use “Export PDF” to download the file instead.";
        setExportError(msg);
        toast.error(msg);
        setExporting(false);
        return;
      }
      w.document.write(printableHtml());
      w.document.close();
      setTimeout(() => {
        try { w.focus(); w.print(); }
        catch (e) {
          const msg = `Could not open the print dialog: ${e instanceof Error ? e.message : String(e)}`;
          setExportError(msg);
          toast.error(msg);
        } finally { setExporting(false); }
      }, 250);
    } catch (e) {
      const msg = `Printing failed: ${e instanceof Error ? e.message : String(e)}`;
      setExportError(msg);
      toast.error(msg);
      setExporting(false);
    }
  };


  // ---- Stamp placement (drag on the preview) ------------------------------
  // Placement moves instantly on screen; the write lands once the user stops
  // nudging (repeated +/- clicks would otherwise fire one write each).
  const placeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (placeTimer.current) clearTimeout(placeTimer.current); }, []);

  const commitPlace = useCallback((next: { x?: number; y?: number; scale?: number }) => {
    const before = { x: doc?.stampX, y: doc?.stampY, scale: doc?.stampScale };
    setPlace(next);
    if (placeTimer.current) clearTimeout(placeTimer.current);
    placeTimer.current = setTimeout(() => {
      placeTimer.current = null;
      onDocChange?.({
        stampX: next.x, stampY: next.y, stampScale: next.scale, stampDirty: false,
      });
      if (audit && doc) {
        logStampChange({
          ...audit, docNumber: doc.number,
          summary: describePlacement(before, next),
          details: { before, after: next },
        });
      }
    }, 500);
  }, [onDocChange, audit, doc]);

  const startStampDrag = (e: React.PointerEvent) => {
    if (!stampUrl) return;
    e.preventDefault();
    const wrap = (e.currentTarget as HTMLElement).parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const x = clamp(((ev.clientX - rect.left) / rect.width) * 100, 0, 100);
      const y = clamp(((ev.clientY - rect.top) / rect.height) * 100, 0, 100);
      setPlace((p) => ({ ...p, x, y }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPlace((p) => { commitPlace(p); return p; });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Same geometry as the exported page; only the visual size follows the zoom.
  const stampGeom = stampGeometry(company, place);
  const stampBoxW = stampGeom.width * zoom;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,1180px)] p-0 gap-0 h-[94dvh] max-h-[94dvh] overflow-hidden flex flex-col">

        <div className="shrink-0 flex items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="min-w-0 flex items-baseline gap-2">
            <span className="truncate text-sm font-medium">{titleFor(doc?.kind)} · {doc?.number}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{pages} page{pages > 1 ? "s" : ""}</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* Zoom */}
            <div className="flex items-center rounded-full border border-border overflow-hidden">
              <button
                type="button" aria-label="Zoom out"
                onClick={() => applyZoom(zoom - 0.1)}
                className="px-2 py-1 hover:bg-muted transition disabled:opacity-40"
                disabled={zoom <= MIN_ZOOM + 0.001}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button" onClick={setActual} title="Actual size (100%)"
                className="px-1 py-0.5 text-[11px] tabular-nums hover:bg-muted transition min-w-[44px]"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button" aria-label="Zoom in"
                onClick={() => applyZoom(zoom + 0.1)}
                className="px-2 py-1 hover:bg-muted transition disabled:opacity-40"
                disabled={zoom >= MAX_ZOOM - 0.001}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex rounded-full border border-border overflow-hidden text-[11px]">
              <button
                type="button" onClick={setFit}
                className={`px-2.5 py-1 transition ${mode === "fit" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <Maximize2 className="h-3 w-3 inline mr-1" />Fit
              </button>
              <button
                type="button" onClick={setActual}
                className={`px-2.5 py-1 transition ${mode === "actual" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                100%
              </button>
            </div>

            {/* Everything else lives here so the bar never wraps. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="rounded-full">
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Display
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 max-h-[70vh] overflow-y-auto space-y-3.5 text-xs">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Content</p>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox checked={showStatus} onCheckedChange={(v) => setShowStatus(!!v)} /> Show status
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox checked={showClientEmail} onCheckedChange={(v) => setShowClientEmail(!!v)} /> Show client email
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox checked={showUnit} onCheckedChange={(v) => setShowUnit(!!v)} /> Show unit column
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox checked={showPayment} onCheckedChange={(v) => setShowPayment(!!v)} /> Show payment details
                  </label>
                  {company?.stampUrl ? (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={showStamp} onCheckedChange={(v) => setShowStamp(!!v)} /> Show stamp
                    </label>
                  ) : null}
                  {signer.signatureRef ? (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={showSignature} onCheckedChange={(v) => setShowSignature(!!v)} /> Show signature
                    </label>
                  ) : null}
                </div>

                {signers && signers.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Signer</p>
                    <select
                      value={signerId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value || undefined;
                        const prev = signers.find((u) => u.userId === signerId)?.name ?? "nobody";
                        const next = signers.find((u) => u.userId === v)?.name ?? "nobody";
                        setSignerId(v);
                        onDocChange?.({ signerId: v, stampDirty: false });
                        if (audit && doc && v !== signerId) {
                          logSignerChange({
                            ...audit, docNumber: doc.number,
                            summary: `Signer changed from ${prev} to ${next}`,
                            details: { before: signerId ?? null, after: v ?? null },
                          });
                        }
                      }}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] focus-ring"
                      aria-label="Document signer"
                    >
                      <option value="">No signature</option>
                      {signers.map((u) => (
                        <option key={u.userId} value={u.userId}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {company?.stampUrl && showStamp ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stamp</p>
                    <div className="flex rounded-md border border-border overflow-hidden text-[11px] w-fit">
                      <button
                        type="button"
                        onClick={() => commitPlace(floating ? {} : { x: 76, y: 86, scale: place.scale ?? 1 })}
                        className={`px-2 py-1 transition ${floating ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        title="Drag the stamp anywhere on the page"
                      >
                        {floating ? "Free placement" : "Place freely"}
                      </button>
                      <button
                        type="button" aria-label="Smaller stamp"
                        onClick={() => commitPlace({ ...place, scale: clamp((place.scale ?? 1) - 0.1, 0.3, 3) })}
                        className="px-2 py-1 hover:bg-muted transition"
                      >
                        −
                      </button>
                      <button
                        type="button" aria-label="Bigger stamp"
                        onClick={() => commitPlace({ ...place, scale: clamp((place.scale ?? 1) + 0.1, 0.3, 3) })}
                        className="px-2 py-1 hover:bg-muted transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Language</p>
                  <div className="flex rounded-md border border-border overflow-hidden w-fit">
                    {DOC_LANGUAGES.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => setLang(l.value)}
                        className={`px-2.5 py-1 text-[11px] transition ${lang === l.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        {l.value.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Logo size</p>
                  <div className="flex rounded-md border border-border overflow-hidden w-fit">
                    {([["S", 0.7], ["M", 1], ["L", 1.5]] as const).map(([label, v]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setLogoScale(v)}
                        className={`px-2.5 py-1 text-[11px] transition ${logoScale === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Layout</p>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox checked={fitOnePage} onCheckedChange={(v) => setFitOnePage(!!v)} />
                    Force one A4 page on export
                  </label>
                  <div className="flex flex-wrap rounded-md border border-border overflow-hidden text-[11px] w-fit">
                    {([["Fit 1 page", "auto"], ["Compact", "compact"], ["Normal", "normal"], ["Spacious", "spacious"]] as const).map(([label, v]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDensity(v)}
                        className={`px-2 py-1 transition ${density === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setColWidths({})}
                    className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted transition"
                  >
                    Reset columns
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <Button size="sm" variant="outline" className="rounded-full" onClick={printPdf} disabled={exporting}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print
            </Button>
            <Button size="sm" className="rounded-full" onClick={downloadPdf} disabled={exporting} aria-live="polite">
              {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
              {exporting ? EXPORT_LABEL[exportStage ?? "preparing"] : "Export PDF"}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)} aria-label="Close preview"><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {exportError && (
          <div className="shrink-0 flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="flex-1">{exportError}</span>
            <button type="button" className="underline" onClick={downloadPdf}>Retry</button>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto overscroll-contain bg-neutral-200 dark:bg-neutral-900 p-6">
          <div className="relative mx-auto" style={{ width: SHEET_W * zoom, height: sheetH * zoom }}>
            <div
              ref={sheetRef}
              className="bg-white text-neutral-900 shadow-xl"
              style={{
                width: "210mm", minHeight: "297mm", padding: "22mm",
                transform: `scale(${zoom})`, transformOrigin: "top left",
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {/* Draggable stamp: free placement saved per document */}
            {floating && stampUrl && showStamp ? (
              <div
                role="button"
                tabIndex={0}
                aria-label="Drag to position the stamp"
                onPointerDown={startStampDrag}
                className="absolute z-20 cursor-grab active:cursor-grabbing rounded-md ring-2 ring-primary/50 hover:ring-primary transition"
                style={{
                  left: `${stampGeom.x}%`, top: `${stampGeom.y}%`,
                  width: stampBoxW, transform: "translate(-50%, -50%)",
                  opacity: stampGeom.opacity,
                  touchAction: "none",
                }}
              >
                <img src={stampUrl} alt="" draggable={false} className="w-full select-none pointer-events-none" />
              </div>
            ) : null}


            {/* Column resize handles, overlaid on the table header borders */}
            {handles.map((h) => (
              <div
                key={h.key}
                role="separator"
                aria-label="Resize column"
                onPointerDown={startColDrag(h.key)}
                className="absolute z-10 w-2 -ml-1 cursor-col-resize group"
                style={{ left: h.x, top: h.top, height: h.height }}
              >
                <div className="mx-auto h-full w-px bg-transparent group-hover:bg-primary transition-colors" />
              </div>
            ))}
          </div>
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

function headingFor(k: DocKind, lang?: DocLanguage) {
  const t = docLabels(lang);
  if (k === "po") return t.po;
  if (k === "quote") return t.quote;
  return t.invoice;
}

/** Signature (per user) + company stamp block printed above the footer. */
function signBlockHtml({
  company, showStamp, stampUrl, showSignature, signatureUrl, signerName, lang, floating,
}: {
  company?: Company; showStamp?: boolean; stampUrl?: string;
  showSignature?: boolean; signatureUrl?: string; signerName?: string; lang: DocLanguage;
  /** The stamp is drawn as a free-floating overlay instead of inside the block. */
  floating?: boolean;
}) {
  const stampOn = !floating && (showStamp ?? company?.showStamp === true) && !!stampUrl;
  const signOn = showSignature !== false && (!!signatureUrl || !!signerName);
  if (!stampOn && !signOn) return "";

  const stampWidth = Math.round(company?.stampWidth ?? 140);
  const opacity = Math.min(1, Math.max(0.1, company?.stampOpacity ?? 1));
  const position = company?.stampPosition ?? "bottom-right";
  const align = position === "bottom-left" ? "flex-start" : position === "center" ? "center" : "flex-end";

  const stampImg = stampOn
    ? `<img src="${esc(stampUrl)}" alt="" style="width:${stampWidth}px;max-width:45%;opacity:${opacity};object-fit:contain;" />`
    : "";
  const signBlock = signOn
    ? `<div style="min-width:180px;text-align:${position === "bottom-left" ? "left" : "right"};">
        ${signatureUrl ? `<img src="${esc(signatureUrl)}" alt="" style="height:52px;max-width:200px;object-fit:contain;" />` : `<div style="height:52px;"></div>`}
        <div style="border-top:1px solid #cbd5e1;margin-top:4px;padding-top:4px;font-size:10px;color:#475569;">
          ${esc(lang === "fr" ? "Signature" : "Signature")}${signerName ? ` — ${esc(signerName)}` : ""}
        </div>
      </div>`
    : "";

  const inner = position === "bottom-left" ? `${stampImg}${signBlock}` : `${signBlock}${stampImg}`;
  return `<div class="signblock" style="margin-top:28px;display:flex;gap:24px;align-items:flex-end;justify-content:${align};">${inner}</div>`;
}


function buildHTML({ doc, company, client, project, showStatus, showPayment, showClientEmail, showUnit, logoUrl, logoScale, lang, cols, scale, showStamp, stampUrl, showSignature, signatureUrl, signerName, stampX, stampY, stampScale }: DocumentHtmlArgs) {
  const unitVisible = showUnit !== false;
  const w = normalizeCols(cols, unitVisible);
  const s = clamp(scale ?? 1, 0.5, 1.4);
  const px = (n: number) => `${Math.round(n * s * 100) / 100}px`;



  const L = (lang ?? doc.language ?? (company?.defaultDocumentLanguage as DocLanguage) ?? "en") as DocLanguage;
  const t = docLabels(L);
  const df = docDateFormat(L);
  // Free placement: when the document carries coordinates, the stamp is drawn
  // as a page-level overlay (added by the printable wrapper / the preview
  // overlay) instead of inside the signature block, so the same percentage
  // resolves to the same physical spot in both renderers.
  const stampVisible = (showStamp ?? company?.showStamp === true) && !!stampUrl;
  const floatStamp = stampVisible && stampX != null && stampY != null;

  const rawColor = company?.color ?? "#1e293b";
  // Validate against a strict CSS color allowlist to prevent CSS/script injection
  // via the company.color field (it is embedded verbatim in a <style> block below).
  const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)|oklch\(\s*[\d.%\s]+\)|[a-zA-Z]{3,30})$/;
  const accent = SAFE_COLOR.test(rawColor.trim()) ? rawColor.trim() : "#1e293b";
  const issued = format(parseISO(doc.issueDate), df);
  const due = doc.dueDate ? format(parseISO(doc.dueDate), df) : null;
  const paidOn = doc.paidDate ? format(parseISO(doc.paidDate), df) : null;
  const subtotalHT = doc.amount ?? 0;
  // Discounts: gross comes from the lines, the stored amount is already net.
  const grossLines = (doc.lines ?? []).reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.rate) || 0),
    0,
  );
  const lineDiscountTotal = Math.round(
    (doc.lines ?? []).reduce((sum, l) => {
      const g = (Number(l.quantity) || 0) * (Number(l.rate) || 0);
      const d = Math.min(100, Math.max(0, Number(l.discountPct) || 0));
      return sum + (g * d) / 100;
    }, 0),
  );
  const globalDiscountPct = Math.min(100, Math.max(0, Number(doc.discountPct) || 0));
  const grossSubtotal = Math.round(grossLines) || subtotalHT + lineDiscountTotal;
  const afterLineDiscounts = grossSubtotal - lineDiscountTotal;
  const globalDiscountAmount = Math.round((afterLineDiscounts * globalDiscountPct) / 100);
  const showDiscountRows = lineDiscountTotal > 0 || globalDiscountAmount > 0;
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
        <h2 style="margin-bottom:10px;">${esc(t.paymentTitle)}</h2>
        <div class="paygrid">
          ${wireLines.length ? `<div class="paycol">
            <div class="paytitle">${esc(t.bankWire)}</div>
            ${wireLines.map((l) => `<div>${esc(l)}</div>`).join("")}
          </div>` : ""}
          ${mobileLines.length ? `<div class="paycol">
            <div class="paytitle"><span class="paybadge">${esc(bank?.mobileProvider ?? t.mobileMoney)}</span></div>
            ${mobileLines.map((l) => `<div>${esc(l)}</div>`).join("")}
          </div>` : ""}
        </div>
        <div class="payref">${esc(t.paymentRef(doc.number))}</div>
      </div>`
    : "";

  const statusColors: Record<string, string> = {
    draft: "#71717a", sent: "#0891b2", partial: "#ca8a04", paid: "#16a34a",
    overdue: "#dc2626", cancelled: "#475569", issued: "#0891b2",
    fulfilled: "#16a34a", accepted: "#16a34a", rejected: "#dc2626",
    expired: "#ca8a04",
  };

  const dueLabel = doc.kind === "quote" ? t.validUntil : t.due;

  // Line items: either explicit lines, or single-row fallback.
  const linesHtml = doc.lines && doc.lines.length > 0
    ? doc.lines.map((l) => {
        const qty = Number(l.quantity) || 0;
        const rate = Number(l.rate) || 0;
        const disc = Math.min(100, Math.max(0, Number(l.discountPct) || 0));
        const total = qty * rate * (1 - disc / 100);
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
            ${unitVisible ? `<td class="num">${esc(l.unit)}</td>` : ""}
            <td class="num">${fmt(rate, doc.currency)}${disc > 0 ? `<div class="sub">−${disc}%</div>` : ""}</td>
            <td class="num">${fmt(total, doc.currency)}</td>
          </tr>
        `;
      }).join("")

    : `
      <tr>
        <td>
          <div style="font-weight: 600;">${esc(project?.name ?? t.services)}</div>
          ${project ? `<div style="color: #64748b; font-size: 10px; margin-top: 2px;">${esc(t.project)} · ${esc(project.name)}</div>` : ""}
        </td>
        <td class="num">1</td>
        ${unitVisible ? `<td class="num">fixed</td>` : ""}
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
      .doc { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; font-size: ${px(12)}; line-height: 1.5; }
      .doc h1 { font-family: "Figtree", "Inter", sans-serif; font-size: ${px(28)}; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: ${accent}; }

      .doc h2 { font-family: "Figtree", "Inter", sans-serif; font-size: ${px(10)}; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; margin: 0 0 6px; font-weight: 600; }
      .doc .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
      .doc .meta { text-align: right; font-size: ${px(11)}; }
      .doc .pill { display: inline-block; font-family: "Figtree", "Inter", sans-serif; padding: 3px 10px; border-radius: 999px; font-size: ${px(10)}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: white; background: ${statusColors[doc.status] ?? "#475569"}; }
      .doc .grid { display: grid; grid-template-columns: 1fr 1fr; gap: ${px(32)}; margin-top: ${px(28)}; }
      .doc .party div { margin-bottom: 2px; }
      .doc .legal { margin-top: 6px; color: #64748b; font-size: ${px(10)}; }
      .doc .taxmeta { margin-top: 8px; padding: 8px 10px; background: #f8fafc; border-left: 3px solid ${accent}; font-size: ${px(10)}; color: #475569; font-variant-numeric: tabular-nums; }
      .doc table { width: 100%; border-collapse: collapse; margin-top: ${px(32)}; font-size: ${px(11)}; table-layout: fixed; }
      .doc th { text-align: left; padding: ${px(10)} ${px(8)}; background: #f8fafc; border-bottom: 2px solid ${accent}; font-size: ${px(10)}; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
      .doc td { padding: ${px(12)} ${px(8)}; border-bottom: 1px solid #e2e8f0; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
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

      .doc .totals { margin-top: 20px; margin-left: auto; width: 280px; font-size: 11px; font-variant-numeric: tabular-nums; }
      .doc .totals .line { display: flex; justify-content: space-between; padding: 6px 0; }
      .doc .totals .grand { font-family: "Figtree", "Inter", sans-serif; border-top: 2px solid ${accent}; margin-top: 6px; padding-top: 10px; font-size: 14px; font-weight: 700; }

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
    <div class="doc" style="position:relative;">
      <div class="row">
        <div>
          ${logoHtml}
          <h1>${esc(headingFor(doc.kind, L))}</h1>
          <div style="margin-top: 8px; font-size: 13px; font-weight: 600;">${esc(doc.number)}</div>
          ${doc.subject ? `<div style="margin-top: 6px; font-size: 12px; color: #0f172a;"><strong>${esc(t.object)}:</strong> ${esc(doc.subject)}</div>` : ""}
          ${refsHtml ? `<div style="margin-top: 6px; font-size: 11px; color: #475569;">${refsHtml}</div>` : ""}
        </div>
        <div class="meta">
          ${showStatus ? `<div class="pill">${esc(doc.status)}</div>` : ""}
          <div style="margin-top: 10px;"><strong>${esc(t.issued)}:</strong> ${issued}</div>
          ${due ? `<div><strong>${dueLabel}:</strong> ${due}</div>` : ""}
          ${paidOn ? `<div><strong>${esc(t.paid)}:</strong> ${paidOn}</div>` : ""}
          ${doc.clientReference ? `<div><strong>${esc(t.clientRef)}:</strong> ${esc(doc.clientReference)}</div>` : ""}
        </div>
      </div>

      <div class="grid">
        <div class="party">
          <h2>${esc(t.from)}</h2>
          ${companyLines.map((l) => `<div>${esc(l)}</div>`).join("")}
          ${companyLegal.length ? `<div class="legal">${companyLegal.map(esc).join(" · ")}</div>` : ""}
        </div>
        <div class="party">
          <h2>${esc(doc.kind === "po" ? t.issuedBy : t.billTo)}</h2>
          <div style="font-weight: 700; font-size: 13px;">${esc(client?.name ?? "—")}</div>
          ${[client?.address, showClientEmail === false ? null : client?.email, client?.phone].filter(Boolean).map((l) => `<div>${esc(l as string)}</div>`).join("")}
          ${taxMeta.length ? `<div class="taxmeta">${taxMeta.map((l) => `<div>${esc(l)}</div>`).join("")}</div>` : ""}
        </div>
      </div>

      <table>
        <colgroup>
          <col style="width: ${w.desc.toFixed(3)}%;" />
          <col style="width: ${w.qty.toFixed(3)}%;" />
          ${unitVisible ? `<col style="width: ${w.unit.toFixed(3)}%;" />` : ""}
          <col style="width: ${w.rate.toFixed(3)}%;" />
          <col style="width: ${w.total.toFixed(3)}%;" />
        </colgroup>
        <thead>
          <tr>
            <th>${esc(t.description)}</th>
            <th class="num">${esc(t.quantity)}</th>
            ${unitVisible ? `<th class="num">${esc(t.unit)}</th>` : ""}
            <th class="num">${esc(t.unitPrice)}</th>
            <th class="num">${esc(t.lineTotal)}</th>
          </tr>
        </thead>

        <tbody>${linesHtml}</tbody>
      </table>

      <div class="totals">
        ${showDiscountRows ? `
          <div class="line"><span>${esc(t.grossSubtotal)}</span><span>${fmt(grossSubtotal, doc.currency)}</span></div>
          ${lineDiscountTotal > 0 ? `<div class="line"><span>${esc(t.lineDiscounts)}</span><span>−${fmt(lineDiscountTotal, doc.currency)}</span></div>` : ""}
          ${globalDiscountAmount > 0 ? `<div class="line"><span>${esc(t.discount)} (${globalDiscountPct}%)</span><span>−${fmt(globalDiscountAmount, doc.currency)}</span></div>` : ""}
        ` : ""}
        <div class="line"><span>${esc(t.subtotal)}</span><span>${fmt(subtotalHT, doc.currency)}</span></div>
        <div class="line"><span>${esc(t.vat)} (${Number(vatRate).toFixed(2)}%)</span><span>${fmt(vatAmount, doc.currency)}</span></div>
        <div class="line grand"><span>${esc(t.total)}</span><span>${fmt(totalTTC, doc.currency)}</span></div>
        ${doc.kind === "invoice" || doc.kind === "quote" ? `
          <div class="arrete">${esc(t.amountInWords(amountInFrench(totalTTC, doc.currency)))}</div>
        ` : ""}
        ${doc.kind === "invoice" ? `
          <div class="line"><span>${esc(t.paidToDate)}</span><span>${fmt(doc.paid ?? 0, doc.currency)}</span></div>
          <div class="line grand"><span>${esc(t.balanceDue)}</span><span class="due">${fmt(balance, doc.currency)}</span></div>
        ` : ""}
      </div>

      ${doc.notes ? `<div class="notes"><strong>${esc(t.notes)}</strong><div style="margin-top: 4px;">${esc(doc.notes)}</div></div>` : ""}
      ${paymentHtml}
      ${signBlockHtml({ company, showStamp, stampUrl, showSignature, signatureUrl, signerName, lang: L, floating: floatStamp })}
      

      <div class="footer">
        ${esc(doc.kind === "invoice"
          ? t.footerInvoice(doc.number)
          : doc.kind === "quote"
          ? t.footerQuote(doc.number, due ?? "—")
          : t.footerPo(doc.number))}
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
  /** Print the per-line unit column (default true). */
  showUnit?: boolean;
  /** Resolved (signed) company logo URL — storage refs must be resolved by the caller. */
  logoUrl?: string;
  /** Per-document multiplier applied to the company's logo size (1 = company default). */
  logoScale?: number;
  /** Printed language; falls back to the document, then the company default, then English. */
  lang?: DocLanguage;
  /** Table column widths in percent (normalised internally). */
  cols?: ColWidths;
  /** Density / auto-fit multiplier applied to font sizes and paddings. */
  scale?: number;
  /** Print the company stamp (defaults to the company setting). */
  showStamp?: boolean;
  /** Resolved (signed) company stamp URL. */
  stampUrl?: string;
  /** Print the signature block of the document's signer. */
  showSignature?: boolean;
  /** Resolved (signed) signature image URL. */
  signatureUrl?: string;
  /** Display name printed under the signature. */
  signerName?: string;
  /** Custom stamp placement in percent of the page; when set the stamp floats. */
  stampX?: number;
  stampY?: number;
  /** Stamp size multiplier relative to the company default width. */
  stampScale?: number;
}


/**
 * Stamp geometry shared by the on-screen overlay and the exported page, so a
 * stamp always lands on the same physical millimetre. Coordinates are percents
 * of the *full* A4 sheet (padding included), never of the content box.
 */
export function stampGeometry(
  company: Company | undefined,
  place: { x?: number; y?: number; scale?: number },
) {
  return {
    floating: place.x != null && place.y != null,
    x: clamp(place.x ?? 50, 0, 100),
    y: clamp(place.y ?? 50, 0, 100),
    /** CSS px width at 100% zoom (1px = 1/96in, same unit as the sheet). */
    width: Math.round((company?.stampWidth ?? 140) * clamp(place.scale ?? 1, 0.3, 3)),
    opacity: clamp(company?.stampOpacity ?? 1, 0.1, 1),
  };
}

/** Page-level floating stamp markup used by the export/print document. */
function floatingStampHtml(args: DocumentHtmlArgs) {
  const visible = (args.showStamp ?? args.company?.showStamp === true) && !!args.stampUrl;
  const g = stampGeometry(args.company, { x: args.stampX, y: args.stampY, scale: args.stampScale });
  if (!visible || !g.floating) return "";
  return `<img src="${esc(args.stampUrl)}" alt="" style="position:absolute;left:${g.x}%;top:${g.y}%;transform:translate(-50%,-50%);width:${g.width}px;opacity:${g.opacity};object-fit:contain;pointer-events:none;" />`;
}

export function buildPrintableDocument(args: DocumentHtmlArgs) {
  // Zero page margin + an inner padded container: the sheet element is a full
  // A4 box, exactly like the preview, so percent coordinates match 1:1.
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(args.doc.number)}</title>
    ${EXPORT_FONT_LINKS}
    <style>
      ${EXPORT_TYPOGRAPHY_CSS}
      @page { size: A4; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
      .sheet { position: relative; width: 210mm; min-height: 297mm; box-sizing: border-box; background: #fff; }
      .sheet-pad { padding: ${PAGE_PAD_MM}mm; }
    </style>

    </head><body><div class="sheet" style="position:relative;width:210mm;min-height:297mm;box-sizing:border-box;background:#fff;"><div class="sheet-pad" style="padding:${PAGE_PAD_MM}mm;">${buildHTML(args)}</div>${floatingStampHtml(args)}</div></body></html>`;
}

export function buildDocumentHTML(args: DocumentHtmlArgs) {
  return buildHTML(args);
}


function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
