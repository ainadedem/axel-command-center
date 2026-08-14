import type { ReactNode } from "react";
import {
  FileEdit, Send, PieChart, CheckCircle2, AlertTriangle, XCircle,
  FileWarning, FileCheck2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger" | "muted";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-border text-muted-foreground bg-muted/40",
  info: "border-primary/30 text-primary bg-primary/10",
  warning: "border-warning/40 text-warning bg-warning/10",
  success: "border-success/40 text-success bg-success/10",
  danger: "border-destructive/40 text-destructive bg-destructive/10",
  muted: "border-muted-foreground/30 text-muted-foreground bg-muted/30 line-through",
};

type StatusMeta = { label: string; tone: StatusTone; icon: ReactNode };

const ICON = "h-3 w-3 shrink-0";

/** Shared status vocabulary — reused by invoices, quotations and purchase orders. */
export const STATUS_META: Record<string, StatusMeta> = {
  draft: { label: "Draft", tone: "neutral", icon: <FileEdit className={ICON} /> },
  sent: { label: "Sent", tone: "info", icon: <Send className={ICON} /> },
  pending: { label: "Pending", tone: "info", icon: <Clock className={ICON} /> },
  partial: { label: "Partial", tone: "warning", icon: <PieChart className={ICON} /> },
  paid: { label: "Paid", tone: "success", icon: <CheckCircle2 className={ICON} /> },
  accepted: { label: "Accepted", tone: "success", icon: <CheckCircle2 className={ICON} /> },
  approved: { label: "Approved", tone: "success", icon: <CheckCircle2 className={ICON} /> },
  overdue: { label: "Overdue", tone: "danger", icon: <AlertTriangle className={ICON} /> },
  rejected: { label: "Rejected", tone: "danger", icon: <XCircle className={ICON} /> },
  declined: { label: "Declined", tone: "danger", icon: <XCircle className={ICON} /> },
  expired: { label: "Expired", tone: "warning", icon: <Clock className={ICON} /> },
  cancelled: { label: "Cancelled", tone: "muted", icon: <XCircle className={ICON} /> },
};

export function StatusBadge({
  status,
  title,
  className,
}: {
  status: string;
  title?: string;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? {
    label: status,
    tone: "neutral" as StatusTone,
    icon: <FileEdit className={ICON} />,
  };
  return (
    <span
      title={title ?? meta.label}
      aria-label={`Status: ${meta.label}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-[10px] font-medium uppercase tracking-wider leading-4",
        "transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        toneClasses[meta.tone],
        className,
      )}
    >
      {meta.icon}
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

/** Purchase-order state chip: missing / bypassed / linked. */
export function PoBadge({
  state,
  title,
  className,
}: {
  state: "missing" | "waived" | "linked";
  title?: string;
  className?: string;
}) {
  const meta =
    state === "linked"
      ? { label: "PO", tone: "success" as StatusTone, icon: <FileCheck2 className={ICON} />, aria: "Purchase order linked" }
      : state === "waived"
        ? { label: "PO bypassed", tone: "warning" as StatusTone, icon: <FileWarning className={ICON} />, aria: "Purchase order bypassed" }
        : { label: "PO missing", tone: "warning" as StatusTone, icon: <FileWarning className={ICON} />, aria: "Purchase order missing" };
  return (
    <span
      title={title ?? meta.aria}
      aria-label={meta.aria}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-[10px] font-medium uppercase tracking-wider leading-4",
        toneClasses[meta.tone],
        className,
      )}
    >
      {meta.icon}
      <span className="truncate">{meta.label}</span>
    </span>
  );
}
