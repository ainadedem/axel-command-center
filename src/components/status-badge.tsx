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
  showLabel = false,
}: {
  status: string;
  title?: string;
  className?: string;
  /** Always show the text (filter bars, drawers). Tables use the hover reveal. */
  showLabel?: boolean;
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
      tabIndex={0}
      className={cn("status-chip", showLabel && "status-chip-static", toneClasses[meta.tone], className)}
    >
      {meta.icon}
      <span className="status-chip-label" aria-hidden={!showLabel}>
        <span>{meta.label}</span>
      </span>
    </span>
  );
}

export type PoState = "missing" | "waived" | "linked";

/** Shared PO vocabulary — reused by invoices, receivables, payables and POs. */
export const PO_META: Record<PoState, { label: string; tone: StatusTone; icon: ReactNode; aria: string }> = {
  linked: { label: "PO", tone: "success", icon: <FileCheck2 className={ICON} />, aria: "Purchase order linked" },
  waived: { label: "PO bypassed", tone: "warning", icon: <FileWarning className={ICON} />, aria: "Purchase order bypassed" },
  missing: { label: "PO missing", tone: "danger", icon: <FileWarning className={ICON} />, aria: "Purchase order missing" },
};

/** Purchase-order state chip: missing / bypassed / linked. */
export function PoBadge({
  state,
  title,
  className,
  showLabel = false,
}: {
  state: PoState;
  title?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const meta = PO_META[state];

  return (
    <span
      title={title ?? meta.aria}
      aria-label={meta.aria}
      tabIndex={0}
      className={cn("status-chip", showLabel && "status-chip-static", toneClasses[meta.tone], className)}
    >
      {meta.icon}
      <span className="status-chip-label" aria-hidden={!showLabel}>
        <span>{meta.label}</span>
      </span>
    </span>
  );
}
