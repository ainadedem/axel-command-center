import { useState, type ReactNode } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Compact icon button used inside Kanban cards. */
export function CardAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "success";
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground",
        "hover:bg-[var(--surface-container)] hover:text-foreground active:scale-95",
        "transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        "disabled:opacity-40 disabled:pointer-events-none",
        tone === "success" && "hover:text-emerald-600",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** Inline "start a comment" box that never leaves the board. */
export function CardCommentAction({
  count,
  onSubmit,
  disabled,
  children,
}: {
  count?: number;
  onSubmit: (text: string) => void | Promise<void>;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Add a comment"
          aria-label="Add a comment"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 h-7 px-1.5 rounded-full text-muted-foreground",
            "hover:bg-[var(--surface-container)] hover:text-foreground active:scale-95",
            "transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
            "disabled:opacity-40 disabled:pointer-events-none",
          )}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          {!!count && <span className="t-micro font-tnum">{count}</span>}
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 space-y-2">
        <Textarea
          autoFocus
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a note…"
          className="t-label"
        />
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 t-label" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            className="h-7 t-label"
            disabled={!text.trim()}
            onClick={async () => {
              await onSubmit(text.trim());
              setText("");
              setOpen(false);
            }}
          >
            Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
