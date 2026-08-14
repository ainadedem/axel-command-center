/**
 * Client-side image validation + resizing helpers.
 *
 * Uploaded pictures are cropped and re-encoded before they ever reach storage,
 * so avatars stay a few tens of kilobytes and render instantly everywhere.
 */

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_IMAGE_SIDE = 64; // px

export interface ImageValidationResult {
  ok: boolean;
  error?: string;
  /** Object URL of the validated file — revoke it when done. */
  url?: string;
  width?: number;
  height?: number;
}

/** Validates type, size and pixel dimensions before any upload happens. */
export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP or GIF image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).` };
  }
  const url = URL.createObjectURL(file);
  const dims = await imageSize(url).catch(() => null);
  if (!dims) {
    URL.revokeObjectURL(url);
    return { ok: false, error: "That file could not be read as an image." };
  }
  if (dims.width < MIN_IMAGE_SIDE || dims.height < MIN_IMAGE_SIDE) {
    URL.revokeObjectURL(url);
    return { ok: false, error: `Image is too small (minimum ${MIN_IMAGE_SIDE}×${MIN_IMAGE_SIDE} px).` };
  }
  return { ok: true, url, width: dims.width, height: dims.height };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image."));
    img.src = src;
  });
}

async function imageSize(src: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(src);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/** Encodes a canvas to a compact WebP file (falls back to PNG when unsupported). */
export function canvasToFile(canvas: HTMLCanvasElement, baseName: string, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error("Could not encode the image.")); return; }
        const webp = blob.type === "image/webp";
        resolve(new File([blob], `${baseName}.${webp ? "webp" : "png"}`, { type: blob.type }));
      },
      "image/webp",
      quality,
    );
  });
}

/* ───────────────────── stamps & signatures ───────────────────── */

export interface MarkProcessOptions {
  /** Longest edge of the output image, in pixels. */
  maxEdge?: number;
  /** Turn a near-white background into transparency (scans of stamps/signatures). */
  keyOutWhite?: boolean;
  /** 0-255 threshold above which a pixel counts as background. */
  whiteThreshold?: number;
  /** Crop away fully transparent / background borders. */
  trim?: boolean;
}

/**
 * Prepares a stamp or signature image for printing on documents:
 * trims empty margins, optionally removes a white scan background,
 * downsizes to a sane print resolution and encodes as PNG (alpha safe).
 */
export async function processMarkImage(file: File, opts: MarkProcessOptions = {}): Promise<File> {
  const { maxEdge = 1000, keyOutWhite = false, whiteThreshold = 240, trim = true } = opts;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0);

    let data: ImageData;
    try { data = ctx.getImageData(0, 0, canvas.width, canvas.height); }
    catch { return file; } // tainted canvas — keep the original

    const px = data.data;
    if (keyOutWhite) {
      for (let i = 0; i < px.length; i += 4) {
        const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
        if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) {
          px[i + 3] = 0;
        }
      }
      ctx.putImageData(data, 0, 0);
    }

    // Bounding box of visible content.
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    if (trim) {
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const visible = px[i + 3] > 12 && !(px[i] >= 250 && px[i + 1] >= 250 && px[i + 2] >= 250 && !keyOutWhite);
          if (visible) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }
    if (maxX < minX || maxY < minY) { minX = 0; minY = 0; maxX = canvas.width - 1; maxY = canvas.height - 1; }
    const pad = 4;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.width - 1, maxX + pad); maxY = Math.min(canvas.height - 1, maxY + pad);
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    const ratio = Math.min(1, maxEdge / Math.max(cropW, cropH));
    const outW = Math.max(1, Math.round(cropW * ratio));
    const outH = Math.max(1, Math.round(cropH * ratio));

    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;
    const octx = out.getContext("2d");
    if (!octx) return file;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "mark";
    const processed = new File([blob], `${base}.png`, { type: "image/png" });
    // Never make things worse: keep the original when it is already smaller.
    return processed.size < file.size * 1.2 ? processed : file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
