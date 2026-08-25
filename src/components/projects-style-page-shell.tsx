import type { ReactNode, Ref } from "react";
import { ListFilter } from "lucide-react";

import { MasterDetail } from "@/components/master-detail";
import { cn } from "@/lib/utils";

export function ProjectsStylePageShell({
  children,
  detail,
  toolbar,
  kpis,
  beforeToolbar,
  afterToolbar,
  className,
  contentClassName,
  rootRef,
  toolbarRef,
  padded = true,
}: {
  children: ReactNode;
  detail?: ReactNode | null;
  toolbar?: ReactNode;
  kpis?: ReactNode;
  beforeToolbar?: ReactNode;
  afterToolbar?: ReactNode;
  className?: string;
  contentClassName?: string;
  rootRef?: Ref<HTMLDivElement>;
  toolbarRef?: Ref<HTMLDivElement>;
  padded?: boolean;
}) {
  return (
    <div ref={rootRef} className={cn("projects-style-page", !padded && "projects-style-page-unpadded", className)}>
      <MasterDetail detail={detail}>
        <div className={cn("projects-style-stack", contentClassName)}>
          {beforeToolbar}
          {toolbar && (
            <div ref={toolbarRef} className="projects-style-toolbar">
              {toolbar}
            </div>
          )}
          {kpis && <div className="projects-style-kpis">{kpis}</div>}
          {children}
          {afterToolbar}
        </div>
      </MasterDetail>
    </div>
  );
}

export function ProjectsStyleToolbarGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("projects-style-toolbar-group", className)}>{children}</div>;
}

export function RecordCountChip({
  count,
  total,
  label,
  filtered,
  className,
}: {
  count: number;
  total?: number;
  label: string;
  filtered?: boolean;
  className?: string;
}) {
  const value = total === undefined ? String(count) : `${count}/${total}`;
  const title = `${count}${total === undefined ? "" : ` of ${total}`} ${label}${filtered ? " · filtered" : ""}`;
  return (
    <span
      title={title}
      aria-label={title}
      className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 text-xs font-tnum text-muted-foreground", className)}
    >
      <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{value}</span>
    </span>
  );
}
