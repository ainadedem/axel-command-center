import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useOpportunities, fmtCompact, toMGA } from "@/lib/mock-data";
import { suggestOpportunity, isOpenStage } from "@/lib/pipeline-link";
import { Sparkles } from "lucide-react";

export const NEW_OPPORTUNITY = "__new_opp__";
export const NO_OPPORTUNITY = "__no_opp__";

/**
 * Picks the pipeline deal a quotation or invoice belongs to.
 * Deals of the same client are listed first and the best match is surfaced as
 * a one-click suggestion.
 */
export function OpportunitySelect({
  companyId, clientId, subject, issueDate, value, onChange, allowCreate = true, label = "Opportunity",
}: {
  companyId: string;
  clientId?: string;
  subject?: string;
  issueDate?: string;
  /** "" = unlinked, NEW_OPPORTUNITY = create one on save. */
  value: string;
  onChange: (v: string) => void;
  allowCreate?: boolean;
  label?: string;
}) {
  const opportunities = useOpportunities();
  const { candidates, auto, best } = useMemo(
    () => suggestOpportunity({ companyId, clientId, subject, issueDate }, opportunities),
    [companyId, clientId, subject, issueDate, opportunities],
  );
  const others = opportunities
    .filter((o) => o.companyId === companyId && !candidates.some((c) => c.id === o.id))
    .sort((a, b) => Number(isOpenStage(b.stage)) - Number(isOpenStage(a.stage)) || a.name.localeCompare(b.name));

  const suggestion = auto ?? best;
  const showSuggestion = !!suggestion && value !== suggestion.id;

  return (
    <div>
      <Label>{label}</Label>
      <Select value={value || NO_OPPORTUNITY} onValueChange={(v) => onChange(v === NO_OPPORTUNITY ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="Link to a deal" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_OPPORTUNITY}>— No deal —</SelectItem>
          {allowCreate && <SelectItem value={NEW_OPPORTUNITY}>＋ Create a new deal from this document</SelectItem>}
          {candidates.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name} · {o.stage} · {fmtCompact(toMGA(o.value, o.currency), "MGA")}
            </SelectItem>
          ))}
          {others.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.name} · {o.stage}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showSuggestion && (
        <button
          type="button"
          onClick={() => onChange(suggestion.id)}
          className="mt-1 inline-flex items-center gap-1 t-label text-primary hover:underline"
        >
          <Sparkles className="h-3 w-3" /> Suggested: {suggestion.name} ({suggestion.stage})
        </button>
      )}
    </div>
  );
}
