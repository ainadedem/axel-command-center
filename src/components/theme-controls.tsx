import { AlignJustify, Monitor, Moon, Rows3, Sun, Type } from "lucide-react";

import { useTheme, type Density, type TextSize, type ThemeMode } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

const DENSITIES: { value: Density; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "compact", label: "Compact", icon: AlignJustify },
  { value: "comfortable", label: "Comfortable", icon: Rows3 },
];

const THEMES: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const SIZES: { value: TextSize; label: string; sample: string }[] = [
  { value: "default", label: "Default", sample: "A" },
  { value: "large", label: "Large", sample: "A" },
  { value: "larger", label: "Larger", sample: "A" },
];

/** Segmented appearance switcher — theme + Dynamic-Type-style text size. */
export function ThemeControls({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, textSize, setTextSize, density, setDensity } = useTheme();

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div>
        {!compact && (
          <div className="text-caption uppercase tracking-wider text-muted-foreground mb-1.5">Appearance</div>
        )}
        <div className="segmented w-full" role="radiogroup" aria-label="Color theme">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${label} theme`}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex-1 min-h-8 px-3 rounded-full text-xs font-medium inline-flex items-center justify-center gap-1.5 focus-ring press-scale",
                  active
                    ? "bg-card text-foreground shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {!compact && (
          <div className="text-caption uppercase tracking-wider text-muted-foreground mb-1.5">Text size</div>
        )}
        <div className="segmented w-full" role="radiogroup" aria-label="Text size">
          <Type className="h-3.5 w-3.5 mx-2 text-muted-foreground shrink-0" aria-hidden="true" />
          {SIZES.map(({ value, label, sample }, i) => {
            const active = textSize === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${label} text size`}
                onClick={() => setTextSize(value)}
                className={cn(
                  "flex-1 min-h-8 px-3 rounded-full font-medium inline-flex items-center justify-center focus-ring press-scale",
                  i === 0 ? "text-[11px]" : i === 1 ? "text-[13px]" : "text-[15px]",
                  active
                    ? "bg-card text-foreground shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {sample}
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {!compact && (
          <div className="text-caption uppercase tracking-wider text-muted-foreground mb-1.5">Density</div>
        )}
        <div className="segmented w-full" role="radiogroup" aria-label="Interface density">
          {DENSITIES.map(({ value, label, icon: Icon }) => {
            const active = density === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${label} density`}
                onClick={() => setDensity(value)}
                className={cn(
                  "flex-1 min-h-8 px-3 rounded-full text-xs font-medium inline-flex items-center justify-center gap-1.5 focus-ring press-scale",
                  active
                    ? "bg-card text-foreground shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
