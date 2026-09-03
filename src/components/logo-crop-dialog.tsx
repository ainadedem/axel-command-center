import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { AVATARS_BUCKET, uploadFile, resolveFileUrl } from "@/lib/storage";
import type { CompanyLogoCrop } from "@/lib/mock-data";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Current logo value (storage ref, data URL or http URL). */
  value?: string;
  /** Existing crop metadata — used to restore the editor and the original image. */
  crop?: CompanyLogoCrop;
  /** Called with the new logo reference and the crop metadata to persist. */
  onApply: (logoUrl: string, crop: CompanyLogoCrop) => void;
  /** Frame aspect ratio (width / height) — matches the document header box. */
  aspect?: number;
}

const FRAME_W = 420;

/**
 * Drag + zoom logo crop editor. The cropped result is rendered on a canvas and
 * uploaded as a new image so PDFs stay crisp; the original source is kept in
 * the crop metadata so the crop can be re-edited or reset later.
 */
export function LogoCropDialog({ open, onOpenChange, value, crop, onApply, aspect = 3.4 }: Props) {
  const frameH = Math.round(FRAME_W / aspect);
  const [sourceUrl, setSourceUrl] = useState<string>();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Resolve the image to edit — prefer the untouched original when we have one.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError("");
    setImg(null);
    (async () => {
      const src = await resolveFileUrl(crop?.sourceRef ?? value);
      if (!alive) return;
      setSourceUrl(src);
      if (!src) { setError("No logo uploaded yet."); return; }
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => { if (alive) setImg(image); };
      image.onerror = () => { if (alive) setError("Could not load the logo image."); };
      image.src = src;
    })();
    return () => { alive = false; };
  }, [open, value, crop?.sourceRef]);

  // Reset the editor transform whenever a new image is loaded.
  useEffect(() => {
    if (!img) return;
    setZoom(crop?.zoom ?? 1);
    setOffset({ x: crop?.offsetX ?? 0, y: crop?.offsetY ?? 0 });
  }, [img, crop?.zoom, crop?.offsetX, crop?.offsetY]);

  /** Base scale = "contain" fit of the image inside the frame. */
  const baseScale = img ? Math.min(FRAME_W / img.width, frameH / img.height) : 1;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = FRAME_W * dpr;
    canvas.height = frameH * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, FRAME_W, frameH);
    const s = baseScale * zoom;
    const w = img.width * s;
    const h = img.height * s;
    ctx.drawImage(img, (FRAME_W - w) / 2 + offset.x, (frameH - h) / 2 + offset.y, w, h);
  }, [img, baseScale, zoom, offset, frameH]);

  useEffect(() => { draw(); }, [draw]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const apply = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    setBusy(true);
    setError("");
    try {
      // Export at 3x the frame size so the PDF stays sharp.
      const out = document.createElement("canvas");
      const scale = 3;
      out.width = FRAME_W * scale;
      out.height = frameH * scale;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const s = baseScale * zoom;
      const w = img.width * s;
      const h = img.height * s;
      ctx.drawImage(img, (FRAME_W - w) / 2 + offset.x, (frameH - h) / 2 + offset.y, w, h);

      const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/png"));
      if (!blob) throw new Error("Could not render the cropped image");
      const file = new File([blob], "logo-cropped.png", { type: "image/png" });
      const ref = await uploadFile(AVATARS_BUCKET, "logos", file);
      onApply(ref, {
        sourceRef: crop?.sourceRef ?? value,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
        aspect,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the crop");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Adjust logo</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <p className="t-label text-muted-foreground">Drag the image to reposition it and zoom to trim white margins. The frame matches the header area on your documents.</p>
          <div
            className="relative mx-auto overflow-hidden rounded-md border border-border bg-white touch-none"
            style={{ width: FRAME_W, height: frameH, maxWidth: "100%" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {img ? (
              <canvas ref={canvasRef} style={{ width: FRAME_W, height: frameH, cursor: "grab" }} />
            ) : (
              <div className="w-full h-full grid place-items-center t-label text-muted-foreground">
                {error || (sourceUrl ? "Loading…" : "No logo")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="t-label text-muted-foreground w-12">Zoom</span>
            <Slider value={[zoom]} min={0.5} max={4} step={0.01} onValueChange={([v]) => setZoom(v)} className="flex-1" />
            <span className="t-label tabular-nums w-12 text-right">{zoom.toFixed(2)}×</span>
          </div>
          {error && img && <p className="t-label text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>Reset view</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={!img || busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Apply crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
