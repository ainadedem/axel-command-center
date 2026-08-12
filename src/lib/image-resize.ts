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
