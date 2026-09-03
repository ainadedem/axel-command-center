import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { AVATARS_BUCKET, uploadFile } from "@/lib/storage";
import { canvasToFile, loadImage } from "@/lib/image-resize";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Object URL (or any loadable URL) of the picture being cropped. */
  sourceUrl?: string;
  /** Output size in pixels (square). */
  size?: number;
  /** Sub-folder inside the avatars bucket. */
  folder?: string;
  /** Receives the uploaded `storage:` reference. */
  onApply: (ref: string) => void;
}

const FRAME = 300;

/**
 * Square drag + zoom crop editor. The result is rendered on a canvas, resized
 * to `size` and re-encoded as WebP before upload so pictures load fast.
 */
export function ImageCropDialog({ open, onOpenChange, sourceUrl, size = 512, folder = "profiles", onApply }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !sourceUrl) return;
    let alive = true;
    setError("");
    setImg(null);
    loadImage(sourceUrl)
      .then((image) => { if (alive) { setImg(image); setZoom(1); setOffset({ x: 0, y: 0 }); } })
      .catch(() => { if (alive) setError("Could not load the image."); });
    return () => { alive = false; };
  }, [open, sourceUrl]);

  // Base scale makes the image cover the square frame at zoom 1.
  const baseScale = img ? Math.max(FRAME / img.naturalWidth, FRAME / img.naturalHeight) : 1;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, FRAME, FRAME);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, FRAME, FRAME);
    const s = baseScale * zoom;
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.drawImage(img, (FRAME - w) / 2 + offset.x, (FRAME - h) / 2 + offset.y, w, h);
  }, [img, baseScale, zoom, offset]);

  useEffect(() => { draw(); }, [draw]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const apply = async () => {
    if (!img) return;
    setBusy(true);
    setError("");
    try {
      const out = document.createElement("canvas");
      out.width = size;
      out.height = size;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      const k = size / FRAME;
      const s = baseScale * zoom * k;
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      ctx.drawImage(img, (size - w) / 2 + offset.x * k, (size - h) / 2 + offset.y * k, w, h);
      const file = await canvasToFile(out, "avatar");
      const ref = await uploadFile(AVATARS_BUCKET, folder, file);
      onApply(ref);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the picture.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Adjust your picture</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center">
            <div
              className="relative rounded-full overflow-hidden border border-border cursor-grab active:cursor-grabbing touch-none"
              style={{ width: FRAME, height: FRAME }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <canvas ref={canvasRef} width={FRAME} height={FRAME} className="block" />
              {!img && !error && (
                <div className="absolute inset-0 grid place-items-center bg-muted/40">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="t-label uppercase tracking-wider text-muted-foreground mb-2">Zoom</div>
            <Slider value={[zoom]} min={1} max={4} step={0.01} onValueChange={([v]) => setZoom(v ?? 1)} aria-label="Zoom" />
          </div>
          <p className="t-label text-muted-foreground text-center">Drag the picture to reposition it.</p>
          {error && <p className="t-label text-destructive text-center">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={apply} disabled={!img || busy}>{busy ? "Saving…" : "Use picture"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
