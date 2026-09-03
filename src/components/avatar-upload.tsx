import { useEffect, useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVATARS_BUCKET, uploadFile } from "@/lib/storage";
import { useFileUrl } from "@/hooks/use-file-url";
import { processMarkImage, validateImageFile } from "@/lib/image-resize";
import { ImageCropDialog } from "@/components/image-crop-dialog";

interface AvatarUploadProps {
  value?: string;
  /** Receives a storage reference (`storage:avatars/...`) or undefined. */
  onChange: (value: string | undefined) => void;
  /** Used to derive initials when no image is set. */
  name?: string;
  /** Pixel size of the avatar. */
  size?: number;
  /** Render as a square (rounded) instead of a circle. */
  square?: boolean;
  /** Sub-folder inside the avatars bucket (e.g. "clients"). */
  folder?: string;
  /** Open a crop editor and resize the result before uploading. */
  crop?: boolean;
  /** Output size (px) of the cropped image. */
  outputSize?: number;
  /**
   * Process the picture as an ink mark (stamp / signature): trim the empty
   * margins, downsize, compress and keep transparency before uploading.
   */
  mark?: boolean;
  /** Turn a near-white scan background into transparency (marks only). */
  keyOutWhite?: boolean;
  className?: string;
}

function initialsOf(name?: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Click-to-upload avatar editor. Uploads to the private `avatars` bucket. */
export function AvatarUpload({ value, onChange, name, size = 64, square, folder = "misc", crop, outputSize = 512, mark, keyOutWhite, className }: AvatarUploadProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cropUrl, setCropUrl] = useState<string | undefined>();
  const src = useFileUrl(value);

  useEffect(() => () => { if (cropUrl) URL.revokeObjectURL(cropUrl); }, [cropUrl]);

  const pick = () => ref.current?.click();
  const handleFile = async (file: File) => {
    setError("");
    setBusy(true);
    try {
      const check = await validateImageFile(file);
      if (!check.ok) { setError(check.error ?? "Invalid image"); return; }
      if (crop) { setCropUrl(check.url); return; }
      if (check.url) URL.revokeObjectURL(check.url);
      const toUpload = mark ? await processMarkImage(file, { keyOutWhite }) : file;
      onChange(await uploadFile(AVATARS_BUCKET, folder, toUpload));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className={cn("relative inline-block group", className)} style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        className={cn(
          "relative overflow-hidden border border-border bg-gradient-to-br from-primary/20 to-chart-2/20 grid place-items-center t-label font-semibold hover:border-primary/50 transition w-full h-full",
          square ? "rounded-lg" : "rounded-full",
        )}
        aria-label="Change profile picture"
      >
        {src ? (
          <img src={src} alt={name ?? ""} className="w-full h-full object-cover" />
        ) : (
          <span className="text-foreground/80" style={{ fontSize: Math.max(10, size / 3.2) }}>
            {initialsOf(name)}
          </span>
        )}
        <span className={cn(
          "absolute inset-0 grid place-items-center bg-black/50 transition",
          busy ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}>
          {busy ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Camera className="h-4 w-4 text-white" />}
        </span>
      </button>
      {error && (
        <div className="absolute top-full left-0 mt-1 t-micro text-destructive whitespace-nowrap">{error}</div>
      )}
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border border-border grid place-items-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
          aria-label="Remove picture"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {crop && (
        <ImageCropDialog
          open={!!cropUrl}
          onOpenChange={(v) => { if (!v) { if (cropUrl) URL.revokeObjectURL(cropUrl); setCropUrl(undefined); } }}
          sourceUrl={cropUrl}
          size={outputSize}
          folder={folder}
          onApply={(refPath) => onChange(refPath)}
        />
      )}
    </div>

  );
}

/** Read-only avatar for lists. Falls back to initials. */
export function Avatar({ src, name, size = 32, square, className }: { src?: string; name?: string; size?: number; square?: boolean; className?: string }) {
  const url = useFileUrl(src);
  return (
    <div
      className={cn(
        "overflow-hidden border border-border/60 bg-gradient-to-br from-primary/25 to-chart-2/25 grid place-items-center font-semibold shrink-0",
        square ? "rounded-md" : "rounded-full",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, size / 3) }}
    >
      {url ? (
        <img src={url} alt={name ?? ""} className="w-full h-full object-cover" />
      ) : (
        <span className="text-foreground/80">{initialsOf(name)}</span>
      )}
    </div>
  );
}
