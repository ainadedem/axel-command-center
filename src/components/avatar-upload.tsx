import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  /** Used to derive initials when no image is set. */
  name?: string;
  /** Pixel size of the avatar. */
  size?: number;
  /** Render as a square (rounded) instead of a circle. */
  square?: boolean;
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

/** Click-to-upload avatar editor. Stores the image as a data URL. */
export function AvatarUpload({ value, onChange, name, size = 64, square, className }: AvatarUploadProps) {
  const ref = useRef<HTMLInputElement>(null);

  const pick = () => ref.current?.click();
  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("relative inline-block group", className)} style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={pick}
        className={cn(
          "relative overflow-hidden border border-border bg-gradient-to-br from-primary/20 to-chart-2/20 grid place-items-center text-xs font-semibold hover:border-primary/50 transition w-full h-full",
          square ? "rounded-lg" : "rounded-full",
        )}
        aria-label="Change profile picture"
      >
        {value ? (
          <img src={value} alt={name ?? ""} className="w-full h-full object-cover" />
        ) : (
          <span className="text-foreground/80" style={{ fontSize: Math.max(10, size / 3.2) }}>
            {initialsOf(name)}
          </span>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
          <Camera className="h-4 w-4 text-white" />
        </span>
      </button>
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
    </div>
  );
}

/** Read-only avatar for lists. Falls back to initials. */
export function Avatar({ src, name, size = 32, square, className }: { src?: string; name?: string; size?: number; square?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden border border-border/60 bg-gradient-to-br from-primary/25 to-chart-2/25 grid place-items-center font-semibold shrink-0",
        square ? "rounded-md" : "rounded-full",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, size / 3) }}
    >
      {src ? (
        <img src={src} alt={name ?? ""} className="w-full h-full object-cover" />
      ) : (
        <span className="text-foreground/80">{initialsOf(name)}</span>
      )}
    </div>
  );
}
