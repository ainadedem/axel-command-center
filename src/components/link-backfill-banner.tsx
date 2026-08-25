import { useState } from "react";
import { Link2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmLink, confirmLinks } from "@/lib/doc-link-write";
import type { BackfillCandidate } from "@/lib/doc-number-link";

/**
 * "N documents can be linked by number" — a one-pass review of every
 * unambiguous number match, so imported history can be corrected.
 */
export function LinkBackfillBanner({
  candidates,
  companyIdOf,
}: {
  candidates: BackfillCandidate[];
  /** Local company id of the document that will be updated. */
  companyIdOf: (c: BackfillCandidate) => string;
}) {
  const [openList, setOpenList] = useState(false);
  if (!candidates.length) return null;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          {candidates.length} document{candidates.length > 1 ? "s" : ""} can be linked by number.
        </span>
        <Button variant="ghost" size="sm" onClick={() => setOpenList((v) => !v)} className="press-scale">
          Review <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${openList ? "rotate-180" : ""}`} />
        </Button>
        <Button
          size="sm"
          onClick={() => confirmLinks(candidates.map((c) => ({ candidate: c, companyId: companyIdOf(c) })))}
          className="press-scale"
        >
          Link all
        </Button>
      </div>
      {openList && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {candidates.map((c) => (
            <li key={`${c.kind}-${c.targetId}-${c.linkId}`} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => confirmLink(c, companyIdOf(c))}>
                Link
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
