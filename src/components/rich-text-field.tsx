import { useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Eye, EyeOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { renderRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  /** Smaller variant used for the secondary "details" field. */
  compact?: boolean;
  /** One-line until focused — used inside dense spreadsheet grids. */
  collapsible?: boolean;
}

type Action = "bold" | "italic" | "ul" | "ol";

function applyAction(text: string, start: number, end: number, action: Action) {
  const selected = text.slice(start, end);
  if (action === "bold" || action === "italic") {
    const mark = action === "bold" ? "**" : "*";
    const body = selected || (action === "bold" ? "bold text" : "italic text");
    const next = `${text.slice(0, start)}${mark}${body}${mark}${text.slice(end)}`;
    return { next, cursor: start + mark.length + body.length + mark.length };
  }
  // list: operate on whole lines of the selection (or the current line)
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = text.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  const block = text.slice(lineStart, lineEnd) || "";
  const lines = block.split("\n");
  const marked = lines.map((l, i) => {
    const stripped = l.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, "");
    return action === "ul" ? `- ${stripped}` : `${i + 1}. ${stripped}`;
  });
  const replacement = marked.join("\n");
  const next = `${text.slice(0, lineStart)}${replacement}${text.slice(lineEnd)}`;
  return { next, cursor: lineStart + replacement.length };
}

export function RichTextField({ value, onChange, placeholder, rows = 3, className, compact, collapsible }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const run = (action: Action) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const { next, cursor } = applyAction(value, start, end, action);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  };

  const html = renderRichText(value);

  return (
    <div className={cn("group rounded-md border border-input bg-background", className)}>
      <div
        className={cn(
          "items-center gap-0.5 border-b border-border px-1 py-0.5",
          collapsible ? "hidden group-focus-within:flex" : "flex",
        )}
      >
        <ToolbarButton label="Bold" onClick={() => run("bold")}><Bold className="h-3 w-3" /></ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => run("italic")}><Italic className="h-3 w-3" /></ToolbarButton>
        <ToolbarButton label="Bullet list" onClick={() => run("ul")}><List className="h-3 w-3" /></ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => run("ol")}><ListOrdered className="h-3 w-3" /></ToolbarButton>
        <div className="ml-auto">
          <ToolbarButton label={preview ? "Hide preview" : "Show preview"} onClick={() => setPreview((p) => !p)} active={preview}>
            {preview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </ToolbarButton>
        </div>
      </div>
      <Textarea
        ref={ref}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "resize-y border-0 shadow-none focus-visible:ring-0 rounded-none",
          collapsible
            ? "text-[11px] min-h-[24px] h-6 py-0.5 leading-5 group-focus-within:min-h-[56px] group-focus-within:h-auto group-focus-within:py-1.5"
            : compact
              ? "text-[11px] min-h-[44px]"
              : "text-xs min-h-[56px]",
        )}
      />

      {preview && (
        <div className="border-t border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Preview</div>
          {html ? (
            <div
              className="rt-preview text-xs leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0.5 [&_div+div]:mt-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="text-xs text-muted-foreground italic">Nothing to preview yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn("h-6 w-6 p-0 text-muted-foreground hover:text-primary", active && "text-primary bg-primary/10")}
    >
      {children}
    </Button>
  );
}
