/**
 * Payment verification chain.
 *
 * For a paid invoice we want a single place answering "was this really paid?":
 * the quotation it came from, the client PO that authorised it and the bank
 * transaction(s) that brought the money in.
 *
 * Everything here is pure so it can be unit-tested and reused by the invoice
 * detail panel, the list badge and the matching dialog.
 */
import { invoicePayable } from "@/lib/invoice-money";

/**
 * - verified    — the whole recorded payment is backed by bank transactions.
 * - installment — part-payment: bank trail matches what was received, balance open.
 * - partial     — money recorded as paid with no bank trail behind part of it.
 * - unverified  — nothing linked at all.
 */
export type Verification = "verified" | "installment" | "partial" | "unverified" | "n/a";

/** Three-state vocabulary used by the shared badge. */
export function badgeState(v: Verification): "verified" | "partial" | "unverified" {
  if (v === "verified") return "verified";
  if (v === "unverified") return "unverified";
  return "partial";
}

export interface ProofInvoice {
  id: string;
  number: string;
  companyId: string;
  clientId?: string;
  projectId?: string;
  quoteId?: string;
  poId?: string;
  poWaived?: boolean;
  poWaiverReason?: string;
  opportunityId?: string;
  status: string;
  amount: number;
  paid: number;
  paidDate?: string;
  issueDate: string;
  taxAmount?: number;
  totalAmount?: number;
  currency: string;
}

export interface ProofTransaction {
  id: string;
  companyId: string;
  accountId: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  currency: string;
  clientId?: string;
  projectId?: string;
  category?: string;
  invoiceId?: string;
}

export interface ProofQuote {
  id: string;
  number: string;
  companyId: string;
  clientId?: string;
  status: string;
  amount: number;
  currency: string;
  opportunityId?: string;
}

export interface ProofPO {
  id: string;
  number: string;
  companyId: string;
  clientId?: string;
  quoteId?: string;
  amount: number;
  currency: string;
  documentUrl?: string;
  documentName?: string;
}

export interface Installment {
  transaction: ProofTransaction;
  /** Cumulative amount covered by bank transactions up to and including this one. */
  runningCovered: number;
  /** Invoice payable minus the running coverage after this installment. */
  remainingAfter: number;
}

export interface PaymentProof {
  quote?: ProofQuote;
  po?: ProofPO;
  /** Bank transactions explicitly linked to this invoice. */
  payments: ProofTransaction[];
  /** Sum of linked payments, in the invoice currency (assumed same). */
  covered: number;
  /** Amount recorded as paid on the invoice. */
  paid: number;
  /** paid − covered, when positive the trail is incomplete. */
  shortfall: number;
  /** Per-transaction evidence chain with running coverage. */
  installments: Installment[];
  /** Total payable on the invoice (tax included). */
  payable: number;
  /** Payable − covered: what is still to be received and matched. */
  outstanding: number;
  verification: Verification;
}

/** Rounding tolerance (MGA has no decimals in practice). */
const TOLERANCE = 1;

export function buildPaymentProof(
  invoice: ProofInvoice,
  transactions: ProofTransaction[],
  quotes: ProofQuote[],
  pos: ProofPO[],
): PaymentProof {
  const po = invoice.poId ? pos.find((p) => p.id === invoice.poId) : undefined;
  const quoteId = invoice.quoteId ?? po?.quoteId;
  const quote = quoteId ? quotes.find((q) => q.id === quoteId) : undefined;

  const payments = transactions
    .filter((t) => t.invoiceId === invoice.id && t.type === "income")
    .sort((a, b) => a.date.localeCompare(b.date));

  const payable = invoicePayable(invoice);
  const covered = payments.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const paid = Number(invoice.paid) || 0;
  const shortfall = Math.max(0, paid - covered);
  const outstanding = Math.max(0, payable - covered);

  let running = 0;
  const installments: Installment[] = payments.map((t) => {
    running += Number(t.amount) || 0;
    return { transaction: t, runningCovered: running, remainingAfter: Math.max(0, payable - running) };
  });

  let verification: Verification = "n/a";
  if (invoice.status === "paid" || paid > 0) {
    if (payments.length === 0) verification = "unverified";
    else if (shortfall > TOLERANCE) verification = "partial";
    else if (outstanding > TOLERANCE) verification = "installment";
    else verification = "verified";
  }

  return {
    quote, po, payments, covered, paid, shortfall,
    installments, payable, outstanding, verification,
  };
}

/** Convenience for list badges — avoids building the whole chain. */
export function verificationOf(
  invoice: ProofInvoice,
  transactions: ProofTransaction[],
): Verification {
  return buildPaymentProof(invoice, transactions, [], []).verification;
}

// ---------------------------------------------------------------------------
// Matching engine
// ---------------------------------------------------------------------------

export type Confidence = "high" | "medium" | "low";

export interface MatchCandidate {
  transaction: ProofTransaction;
  score: number;
  confidence: Confidence;
  amountDelta: number;
  dayGap: number;
  reasons: string[];
}

export interface MatchProposal {
  invoice: ProofInvoice;
  candidates: MatchCandidate[];
  /** Best candidate — pre-ticked in the dialog when confidence is high. */
  best: MatchCandidate;
  /** Quotation the invoice could inherit from its PO / deal. */
  suggestedQuote?: ProofQuote;
  /** PO that plainly belongs to the same quotation. */
  suggestedPo?: ProofPO;
}

const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const daysBetween = (a?: string, b?: string) => {
  if (!a || !b) return 999;
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 999;
};

export function scoreCandidate(
  invoice: ProofInvoice,
  tx: ProofTransaction,
  clientName?: string,
  /** Amount the transaction should settle — defaults to the full payable. */
  targetAmount?: number,
): MatchCandidate {
  const reasons: string[] = [];
  let score = 0;

  const payable = targetAmount != null && targetAmount > 0 ? targetAmount : invoicePayable(invoice);
  const amountDelta = Math.abs((Number(tx.amount) || 0) - payable);
  const rel = payable > 0 ? amountDelta / payable : 1;

  const descNorm = norm(tx.description);
  const numNorm = norm(invoice.number);
  if (numNorm.length >= 4 && descNorm.includes(numNorm)) {
    score += 60;
    reasons.push("invoice number in narrative");
  }

  if (amountDelta <= TOLERANCE) {
    score += 35;
    reasons.push("exact amount");
  } else if (rel <= 0.01) {
    score += 25;
    reasons.push("amount within 1%");
  } else if (rel <= 0.05) {
    score += 12;
    reasons.push("amount within 5%");
  }

  const sameClient = !!invoice.clientId && tx.clientId === invoice.clientId;
  const nameHit =
    !sameClient && !!clientName && norm(clientName).length >= 4 && descNorm.includes(norm(clientName));
  if (sameClient) {
    score += 25;
    reasons.push("same client");
  } else if (nameHit) {
    score += 18;
    reasons.push("client name in narrative");
  }

  const ref = invoice.paidDate ?? invoice.issueDate;
  const dayGap = daysBetween(ref, tx.date);
  if (dayGap <= 7) {
    score += 20;
    reasons.push("same week");
  } else if (dayGap <= 45) {
    score += 12;
    reasons.push(`${dayGap} days apart`);
  } else if (dayGap <= 120) {
    score += 4;
    reasons.push(`${dayGap} days apart`);
  } else {
    score -= 10;
    reasons.push("date far apart");
  }

  const exactStrong = amountDelta <= TOLERANCE && (sameClient || nameHit) && dayGap <= 45;
  const confidence: Confidence =
    exactStrong || score >= 80 ? "high" : score >= 50 ? "medium" : "low";

  return { transaction: tx, score, confidence, amountDelta, dayGap, reasons };
}

export interface ProposeInput {
  invoices: ProofInvoice[];
  transactions: ProofTransaction[];
  quotes: ProofQuote[];
  pos: ProofPO[];
  clientName?: (clientId?: string) => string | undefined;
}

/**
 * Proposes bank transactions for invoices that record a payment but have no
 * linked transaction. A transaction is never proposed twice: the highest
 * scoring invoice claims it.
 */
export function proposeMatches({
  invoices,
  transactions,
  quotes,
  pos,
  clientName,
}: ProposeInput): MatchProposal[] {
  const linked = new Set(transactions.map((t) => t.invoiceId).filter(Boolean) as string[]);
  const outstandingOf = new Map<string, number>();
  const targets = invoices.filter((inv) => {
    if (inv.status === "cancelled") return false;
    const proof = buildPaymentProof(inv, transactions, quotes, pos);
    outstandingOf.set(inv.id, proof.outstanding);
    return proof.verification === "unverified" || proof.verification === "partial" ||
      proof.verification === "installment";
  });

  const free = transactions.filter((t) => t.type === "income" && !t.invoiceId);

  // Build every candidate, then resolve conflicts greedily by score.
  const rows: Array<{ invoice: ProofInvoice; candidates: MatchCandidate[] }> = targets.map((inv) => {
    const name = clientName?.(inv.clientId);
    const candidates = free
      .filter((t) => t.companyId === inv.companyId)
      .map((t) => scoreCandidate(inv, t, name, outstandingOf.get(inv.id)))
      .filter((c) => c.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return { invoice: inv, candidates };
  });

  const claimed = new Set<string>();
  const proposals: MatchProposal[] = [];
  const ordered = [...rows].sort(
    (a, b) => (b.candidates[0]?.score ?? 0) - (a.candidates[0]?.score ?? 0),
  );

  for (const row of ordered) {
    const available = row.candidates.filter((c) => !claimed.has(c.transaction.id));
    const best = available[0];
    if (!best) continue;
    claimed.add(best.transaction.id);

    const po = row.invoice.poId ? pos.find((p) => p.id === row.invoice.poId) : undefined;
    let suggestedQuote: ProofQuote | undefined;
    if (!row.invoice.quoteId) {
      if (po?.quoteId) suggestedQuote = quotes.find((q) => q.id === po.quoteId);
      if (!suggestedQuote && row.invoice.opportunityId) {
        const siblings = quotes.filter((q) => q.opportunityId === row.invoice.opportunityId);
        if (siblings.length === 1) suggestedQuote = siblings[0];
      }
    }
    let suggestedPo: ProofPO | undefined;
    if (!row.invoice.poId && row.invoice.quoteId) {
      const siblings = pos.filter((p) => p.quoteId === row.invoice.quoteId);
      if (siblings.length === 1) suggestedPo = siblings[0];
    }

    proposals.push({ invoice: row.invoice, candidates: available, best, suggestedQuote, suggestedPo });
  }

  // Keep the caller's invoice order stable for review.
  const rank = new Map(invoices.map((i, idx) => [i.id, idx]));
  proposals.sort((a, b) => (rank.get(a.invoice.id) ?? 0) - (rank.get(b.invoice.id) ?? 0));
  void linked;
  return proposals;
}

// ---------------------------------------------------------------------------
// Transaction-side matching: which invoices could this receipt settle?
// ---------------------------------------------------------------------------

export interface TransactionMatch {
  invoice: ProofInvoice;
  candidate: MatchCandidate;
  /** What is still to be matched on that invoice before this receipt. */
  outstanding: number;
}

/**
 * Ranks the invoices a single unlinked bank receipt could belong to, scoring
 * against each invoice's outstanding (unmatched) balance rather than its total.
 */
export function proposeMatchesForTransaction(input: {
  transaction: ProofTransaction;
  invoices: ProofInvoice[];
  transactions: ProofTransaction[];
  quotes: ProofQuote[];
  pos: ProofPO[];
  clientName?: (clientId?: string) => string | undefined;
}): TransactionMatch[] {
  const { transaction: tx, invoices, transactions, quotes, pos, clientName } = input;
  if (tx.type !== "income") return [];

  const rows: TransactionMatch[] = [];
  for (const inv of invoices) {
    if (inv.status === "cancelled") continue;
    if (inv.companyId !== tx.companyId) continue;
    const proof = buildPaymentProof(inv, transactions, quotes, pos);
    if (proof.verification === "verified") continue;
    const outstanding = proof.outstanding > 0 ? proof.outstanding : invoicePayable(inv);
    const candidate = scoreCandidate(inv, tx, clientName?.(inv.clientId), outstanding);
    if (candidate.score < 30) continue;
    rows.push({ invoice: inv, candidate, outstanding });
  }
  return rows.sort((a, b) => b.candidate.score - a.candidate.score).slice(0, 6);
}
