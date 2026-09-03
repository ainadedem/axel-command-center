import { Target, Handshake } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { firstName } from "@/lib/person-name";

/**
 * Role-tagged chips showing who acquired the client and who closes the deal
 * for a quotation. Acquisition is sourced from the client (single source of
 * truth); the closer comes from the linked pipeline deal. The closer chip
 * jumps to that deal in the Pipeline when a deal is linked.
 */
export function QuoteSalesRoles({
  acquisition,
  closer,
  opportunityId,
  size = "sm",
  firstNameOnly = false,
  className = "",
}: {
  acquisition?: string;
  closer?: string;
  opportunityId?: string;
  size?: "xs" | "sm";
  /** Dense tables show only the first name; the full name stays in the tooltip. */
  firstNameOnly?: boolean;
  className?: string;
}) {
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";
  const icon = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";
  const pad = size === "xs" ? "px-1.5 py-0" : "px-1.5 py-0.5";
  const acq = acquisition?.trim();
  const clo = closer?.trim();

  if (!acq && !clo) {
    return <span className={`${text} text-muted-foreground/60 ${className}`}>No sales roles</span>;
  }

  const chip = (
    value: string,
    Icon: typeof Target,
    cls: string,
    asLink: boolean,
  ) => {
    const inner = (
      <span
        title={value}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border",
          pad,
          text,
          cls,
          asLink && "cursor-pointer hover:opacity-80 transition",
        )}
      >
        <Icon className={icon} />
        <span className="truncate max-w-[8rem]">{firstNameOnly ? firstName(value, value) : value}</span>
      </span>
    );
    if (asLink && opportunityId) {
      return (
        <Link
          to="/pipeline"
          search={(prev) => ({ ...prev, opp: opportunityId })}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          className="inline-flex"
        >
          {inner}
        </Link>
      );
    }
    return inner;
  };

  return (
    <span className={cn("inline-flex items-center gap-1 flex-wrap", className)}>
      {acq && chip(acq, Target, "border-sky-500/30 bg-sky-500/10 text-sky-700", false)}
      {clo && chip(clo, Handshake, "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", !!opportunityId)}
    </span>
  );
}
