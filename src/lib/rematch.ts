import {
  proposeMatches, effectiveTermsDays,
  type ProofInvoice, type ProofTransaction, type ProofQuote, type ProofPO,
} from "@/lib/payment-proof";

/** The terms shape that drives matching for one client. */
export interface TermsProfile {
  paymentTermsDays?: number;
  paymentTermsByCurrency?: Record<string, number>;
}

export interface RematchSummary {
  /** Invoices of this client still awaiting a verified receipt. */
  pending: string[];
  /** Proposals that reach high confidence with the new terms. */
  highAfter: number;
  /** Proposals that reached high confidence with the old terms. */
  highBefore: number;
  /** Invoices whose best candidate transaction changed. */
  changed: string[];
}

const bestByInvoice = (
  invoices: ProofInvoice[],
  transactions: ProofTransaction[],
  quotes: ProofQuote[],
  pos: ProofPO[],
  clientName: (id?: string) => string | undefined,
  terms: TermsProfile | undefined,
) => {
  const proposals = proposeMatches({
    invoices, transactions, quotes, pos, clientName,
    clientTerms: (_id, cur) => effectiveTermsDays(terms, cur),
  });
  return new Map(proposals.map((p) => [p.invoice.id, p.best]));
};

/**
 * Re-scores every pending receipt for one client after its payment terms (or
 * currency overrides) change, and reports what moved. Nothing is written: the
 * caller decides whether to open the review dialog.
 */
export function rematchClient(input: {
  clientId: string;
  before?: TermsProfile;
  after?: TermsProfile;
  invoices: ProofInvoice[];
  transactions: ProofTransaction[];
  quotes: ProofQuote[];
  pos: ProofPO[];
  clientName?: string;
}): RematchSummary {
  const { clientId, before, after, invoices, transactions, quotes, pos, clientName } = input;
  const scope = invoices.filter((i) => i.clientId === clientId);
  const name = () => clientName;
  const oldBest = bestByInvoice(scope, transactions, quotes, pos, name, before);
  const newBest = bestByInvoice(scope, transactions, quotes, pos, name, after);

  const changed: string[] = [];
  newBest.forEach((cand, id) => {
    const prev = oldBest.get(id);
    if (!prev || prev.transaction.id !== cand.transaction.id || prev.confidence !== cand.confidence) {
      changed.push(id);
    }
  });
  const countHigh = (m: Map<string, { confidence: string }>) =>
    [...m.values()].filter((c) => c.confidence === "high").length;

  return {
    pending: [...newBest.keys()],
    highAfter: countHigh(newBest),
    highBefore: countHigh(oldBest),
    changed,
  };
}

/** True when two terms profiles would score differently. */
export function termsChanged(a?: TermsProfile, b?: TermsProfile): boolean {
  if ((a?.paymentTermsDays ?? null) !== (b?.paymentTermsDays ?? null)) return true;
  return JSON.stringify(a?.paymentTermsByCurrency ?? {}) !== JSON.stringify(b?.paymentTermsByCurrency ?? {});
}
