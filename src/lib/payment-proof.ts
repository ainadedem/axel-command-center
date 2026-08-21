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
  dueDate?: string;
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
  /** Days between the receipt and the date the client was expected to pay. */
  dayGap: number;
  /** Date the client was expected to pay (terms or learned lag applied). */
  expectedDate?: string;
  /** Actual invoice → receipt lag, in days. */
  lagDays?: number;
  /** How many other open invoices of the same client carry the same amount. */
  ambiguousWith?: number;
  /** The narrative names this invoice (number or billing period). */
  narrativeMatch?: boolean;
  reasons: string[];
}

/** How a client normally pays: contractual terms, or the lag we observed. */
export interface ClientPaymentBehaviour {
  termsDays?: number;
  learnedLagDays?: number;
}

/** Options carrying everything the scorer knows beyond the two records. */
export interface ScoreOptions {
  clientName?: string;
  /** Amount the transaction should settle — defaults to the full payable. */
  targetAmount?: number;
  behaviour?: ClientPaymentBehaviour;
  /** Count of same-client, same-amount open invoices competing for receipts. */
  ambiguousWith?: number;
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

const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const signedDays = (from?: string, to?: string) => {
  if (!from || !to) return undefined;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : undefined;
};

/**
 * When the client is expected to pay: contractual terms first, then the lag we
 * learned from the payments already matched, then the invoice due date.
 * Clients like Airtel settle ~30 days late, so scoring against the issue date
 * would penalise every correct receipt.
 */
export function expectedPaymentDate(
  invoice: ProofInvoice,
  behaviour?: ClientPaymentBehaviour,
): string {
  const terms = behaviour?.termsDays;
  if (terms != null && terms > 0) return addDays(invoice.issueDate, terms);
  const learned = behaviour?.learnedLagDays;
  if (learned != null && learned > 0) return addDays(invoice.issueDate, learned);
  return invoice.dueDate ?? invoice.issueDate;
}

const MONTHS: Record<string, number> = {
  janvier: 1, january: 1, jan: 1,
  fevrier: 2, february: 2, feb: 2, fev: 2,
  mars: 3, march: 3, mar: 3,
  avril: 4, april: 4, apr: 4, avr: 4,
  mai: 5, may: 5,
  juin: 6, june: 6, jun: 6,
  juillet: 7, july: 7, jul: 7, juil: 7,
  aout: 8, august: 8, aug: 8,
  septembre: 9, september: 9, sep: 9, sept: 9,
  octobre: 10, october: 10, oct: 10,
  novembre: 11, november: 11, nov: 11,
  decembre: 12, december: 12, dec: 12,
};

/** True when the narrative names the invoice's billing month ("JUIN 2026", "06/2026"). */
export function narrativeNamesPeriod(description: string, isoDate: string): boolean {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const text = (description ?? "").toLowerCase().replace(/[éèê]/g, "e").replace(/[û]/g, "u").replace(/[à]/g, "a");
  void year;
  for (const [word, m] of Object.entries(MONTHS)) {
    if (m === month && new RegExp(`\\b${word}\\b`).test(text)) return true;
  }
  const mm = String(month).padStart(2, "0");
  if (new RegExp(`\\b${mm}[/\\-.]${year}\\b`).test(text)) return true;
  if (new RegExp(`\\b${year}[/\\-.]${mm}\\b`).test(text)) return true;
  return false;
}

export function scoreCandidate(
  invoice: ProofInvoice,
  tx: ProofTransaction,
  clientName?: string,
  /** Amount the transaction should settle — defaults to the full payable. */
  targetAmount?: number,
  opts?: Pick<ScoreOptions, "behaviour" | "ambiguousWith">,
): MatchCandidate {
  const reasons: string[] = [];
  let score = 0;


  const payable = targetAmount != null && targetAmount > 0 ? targetAmount : invoicePayable(invoice);
  const amountDelta = Math.abs((Number(tx.amount) || 0) - payable);
  const rel = payable > 0 ? amountDelta / payable : 1;

  const descNorm = norm(tx.description);
  const numNorm = norm(invoice.number);
  const numberHit = numNorm.length >= 4 && descNorm.includes(numNorm);
  if (numberHit) {
    score += 60;
    reasons.push("invoice number in narrative");
  }
  const periodHit = !numberHit && narrativeNamesPeriod(tx.description, invoice.issueDate);
  if (periodHit) {
    score += 30;
    reasons.push("billing period in narrative");
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

  // Dates are judged against the day the client was *expected* to pay, not the
  // issue date: a 30-day payer is on time, not "far apart".
  const expected = invoice.paidDate ?? expectedPaymentDate(invoice, opts?.behaviour);
  const dayGap = daysBetween(expected, tx.date);
  const lagDays = signedDays(invoice.issueDate, tx.date);
  const usualLag = opts?.behaviour?.termsDays ?? opts?.behaviour?.learnedLagDays;
  if (dayGap <= 7) {
    score += 20;
    reasons.push(usualLag ? `paid on the usual ${usualLag}-day rhythm` : "same week");
  } else if (dayGap <= 21) {
    score += 14;
    reasons.push(`${dayGap} days from the expected payment date`);
  } else if (dayGap <= 45) {
    score += 8;
    reasons.push(`${dayGap} days from the expected payment date`);
  } else if (dayGap <= 120) {
    score += 2;
    reasons.push(`${dayGap} days from the expected payment date`);
  } else {
    score -= 10;
    reasons.push("date far apart");
  }

  // Several open invoices of the same client with the same amount: nothing in
  // the numbers can tell them apart, so this always needs a human.
  const ambiguousWith = opts?.ambiguousWith ?? 0;
  const decisive = numberHit || periodHit;
  if (ambiguousWith > 0 && !decisive) {
    reasons.push(
      `same amount as ${ambiguousWith} other open invoice${ambiguousWith > 1 ? "s" : ""} for this client`,
    );
  }

  const exactStrong = amountDelta <= TOLERANCE && (sameClient || nameHit) && dayGap <= 45;
  let confidence: Confidence =
    exactStrong || score >= 80 ? "high" : score >= 50 ? "medium" : "low";
  if (ambiguousWith > 0 && !decisive && confidence === "high") confidence = "medium";

  return {
    transaction: tx,
    score,
    confidence,
    amountDelta,
    dayGap,
    expectedDate: expected,
    lagDays,
    ambiguousWith: ambiguousWith || undefined,
    narrativeMatch: decisive || undefined,
    reasons,
  };
}

/**
 * Learns each client's typical invoice → payment lag from the matches already
 * confirmed (median, so one outlier cannot skew a monthly stream).
 */
export function learnClientLags(
  invoices: ProofInvoice[],
  transactions: ProofTransaction[],
): Map<string, number> {
  const byInvoice = new Map(invoices.map((i) => [i.id, i]));
  const lags = new Map<string, number[]>();
  transactions.forEach((t) => {
    if (!t.invoiceId) return;
    const inv = byInvoice.get(t.invoiceId);
    if (!inv?.clientId) return;
    const lag = signedDays(inv.issueDate, t.date);
    if (lag == null || lag < 0 || lag > 365) return;
    const arr = lags.get(inv.clientId) ?? [];
    arr.push(lag);
    lags.set(inv.clientId, arr);
  });
  const out = new Map<string, number>();
  lags.forEach((arr, clientId) => {
    if (arr.length < 2) return;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    out.set(clientId, median);
  });
  return out;
}

/** What we learned about one client's payment lag, with the evidence count. */
export interface TermsSuggestion {
  clientId: string;
  currency?: string;
  /** Median observed invoice -> payment lag, in days. */
  days: number;
  /** How many matched payments the median is based on. */
  samples: number;
  /** Spread between the fastest and slowest observed payment. */
  spreadDays: number;
}

const median = (arr: number[]) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/**
 * Suggests payment terms per client and per currency from the payments already
 * matched. `currency: undefined` is the all-currencies suggestion used for the
 * client's default terms; the per-currency rows drive the overrides.
 */
export function suggestClientTerms(
  invoices: ProofInvoice[],
  transactions: ProofTransaction[],
): TermsSuggestion[] {
  const byInvoice = new Map(invoices.map((i) => [i.id, i]));
  const buckets = new Map<string, { clientId: string; currency?: string; lags: number[] }>();
  const push = (clientId: string, currency: string | undefined, lag: number) => {
    const key = `${clientId}|${currency ?? "*"}`;
    const b = buckets.get(key) ?? { clientId, currency, lags: [] };
    b.lags.push(lag);
    buckets.set(key, b);
  };
  transactions.forEach((t) => {
    if (!t.invoiceId) return;
    const inv = byInvoice.get(t.invoiceId);
    if (!inv?.clientId) return;
    const lag = signedDays(inv.issueDate, t.date);
    if (lag == null || lag < 0 || lag > 365) return;
    push(inv.clientId, undefined, lag);
    push(inv.clientId, inv.currency, lag);
  });
  const out: TermsSuggestion[] = [];
  buckets.forEach((b) => {
    if (b.lags.length < 2) return;
    out.push({
      clientId: b.clientId,
      currency: b.currency,
      days: median(b.lags),
      samples: b.lags.length,
      spreadDays: Math.max(...b.lags) - Math.min(...b.lags),
    });
  });
  return out;
}

/** Resolves effective terms: per-currency override first, then the default. */
export function effectiveTermsDays(
  client: { paymentTermsDays?: number; paymentTermsByCurrency?: Record<string, number> } | undefined,
  currency?: string,
): number | undefined {
  if (!client) return undefined;
  const byCur = currency ? client.paymentTermsByCurrency?.[currency] : undefined;
  return byCur != null && byCur > 0 ? byCur : client.paymentTermsDays;
}

/** Round to the tolerance so "same amount" survives cent-level noise. */
const amountKey = (v: number) => Math.round(v);

/**
 * Groups open invoices by client + payable amount. Any group with more than
 * one member is ambiguous: monthly retainers of the same value cannot be told
 * apart by amount alone.
 */
export function ambiguityIndex(invoices: ProofInvoice[]): Map<string, number> {
  const groups = new Map<string, string[]>();
  invoices.forEach((inv) => {
    if (!inv.clientId) return;
    const key = `${inv.companyId}|${inv.clientId}|${amountKey(invoicePayable(inv))}`;
    groups.set(key, [...(groups.get(key) ?? []), inv.id]);
  });
  const out = new Map<string, number>();
  groups.forEach((ids) => {
    if (ids.length < 2) return;
    ids.forEach((id) => out.set(id, ids.length - 1));
  });
  return out;
}

export interface ProposeInput {
  invoices: ProofInvoice[];
  transactions: ProofTransaction[];
  quotes: ProofQuote[];
  pos: ProofPO[];
  clientName?: (clientId?: string) => string | undefined;
  /** Contractual payment terms, in days, per client. */
  clientTerms?: (clientId?: string, currency?: string) => number | undefined;
}

/**
 * Proposes bank transactions for invoices that record a payment but have no
 * linked transaction. A transaction is never proposed twice: the invoice whose
 * evidence is strongest — and, at equal strength, the one whose expected
 * payment date is closest — claims it, so a monthly stream of identical
 * amounts is matched in order instead of arbitrarily.
 */
export function proposeMatches({
  invoices,
  transactions,
  quotes,
  pos,
  clientName,
  clientTerms,
}: ProposeInput): MatchProposal[] {
  const learned = learnClientLags(invoices, transactions);
  const behaviourOf = (clientId?: string, currency?: string): ClientPaymentBehaviour | undefined =>
    clientId
      ? { termsDays: clientTerms?.(clientId, currency), learnedLagDays: learned.get(clientId) }
      : undefined;
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
  const ambiguity = ambiguityIndex(targets);

  // Build every candidate, then resolve conflicts greedily by score.
  const rows: Array<{ invoice: ProofInvoice; candidates: MatchCandidate[] }> = targets.map((inv) => {
    const name = clientName?.(inv.clientId);
    const opts = { behaviour: behaviourOf(inv.clientId, inv.currency), ambiguousWith: ambiguity.get(inv.id) ?? 0 };
    const candidates = free
      .filter((t) => t.companyId === inv.companyId)
      .map((t) => scoreCandidate(inv, t, name, outstandingOf.get(inv.id), opts))
      .filter((c) => c.score >= 30)
      .sort((a, b) => b.score - a.score || a.dayGap - b.dayGap)
      .slice(0, 5);
    return { invoice: inv, candidates };
  });

  const claimed = new Set<string>();
  const proposals: MatchProposal[] = [];
  const ordered = [...rows].sort((a, b) => {
    const ca = a.candidates[0];
    const cb = b.candidates[0];
    // Narrative evidence first, then score, then the closest expected date, then
    // the oldest invoice — identical monthly amounts settle oldest-first.
    const na = ca?.narrativeMatch ? 1 : 0;
    const nb = cb?.narrativeMatch ? 1 : 0;
    if (na !== nb) return nb - na;
    const s = (cb?.score ?? 0) - (ca?.score ?? 0);
    if (s !== 0) return s;
    const g = (ca?.dayGap ?? 999) - (cb?.dayGap ?? 999);
    if (g !== 0) return g;
    return a.invoice.issueDate.localeCompare(b.invoice.issueDate);
  });

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
  clientTerms?: (clientId?: string, currency?: string) => number | undefined;
}): TransactionMatch[] {
  const { transaction: tx, invoices, transactions, quotes, pos, clientName, clientTerms } = input;
  if (tx.type !== "income") return [];

  const learned = learnClientLags(invoices, transactions);
  const open = invoices.filter((i) => i.status !== "cancelled" && i.companyId === tx.companyId);
  const ambiguity = ambiguityIndex(open);

  const rows: TransactionMatch[] = [];
  for (const inv of open) {
    const proof = buildPaymentProof(inv, transactions, quotes, pos);
    if (proof.verification === "verified") continue;
    const outstanding = proof.outstanding > 0 ? proof.outstanding : invoicePayable(inv);
    const candidate = scoreCandidate(inv, tx, clientName?.(inv.clientId), outstanding, {
      behaviour: inv.clientId
        ? { termsDays: clientTerms?.(inv.clientId, inv.currency), learnedLagDays: learned.get(inv.clientId) }
        : undefined,
      ambiguousWith: ambiguity.get(inv.id) ?? 0,
    });
    if (candidate.score < 30) continue;
    rows.push({ invoice: inv, candidate, outstanding });
  }
  return rows
    .sort(
      (a, b) =>
        (b.candidate.narrativeMatch ? 1 : 0) - (a.candidate.narrativeMatch ? 1 : 0) ||
        b.candidate.score - a.candidate.score ||
        a.candidate.dayGap - b.candidate.dayGap ||
        a.invoice.issueDate.localeCompare(b.invoice.issueDate),
    )
    .slice(0, 6);
}
