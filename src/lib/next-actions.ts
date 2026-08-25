/**
 * "What should I do next?" — turns the live data into a short, prioritised list
 * of plain-language tasks, so somebody with no finance background can still run
 * the business correctly.
 *
 * Everything here is pure: the panel renders whatever these functions return.
 */
import { differenceInDays, parseISO } from "date-fns";
import { toMGA, type Account, type Invoice, type PurchaseOrder, type Quote } from "@/lib/mock-data";
import { invoiceBalance, invoicePayable } from "@/lib/invoice-money";
import { quotePayable } from "@/lib/pipeline-link";
import { invoicesForQuote } from "@/lib/quote-accept";

export type ActionTone = "urgent" | "attention" | "routine";

export interface NextAction {
  id: string;
  tone: ActionTone;
  /** One short sentence saying what to do. */
  title: string;
  /** Why it matters, in everyday words. */
  why: string;
  count: number;
  /** Money at stake, in MGA (omitted when money is not the point). */
  amountMGA?: number;
  /** Where the button goes. */
  to: "/quotations" | "/invoices" | "/purchase-orders" | "/accounts" | "/clients";
  search?: { focus?: string; view?: "list" | "board" };
  cta: string;
}

const days = (iso: string | undefined, today: Date) => {
  if (!iso) return 0;
  try { return differenceInDays(today, parseISO(iso)); } catch { return 0; }
};

const open = (i: Invoice) => i.status !== "cancelled" && i.status !== "paid";

export interface NextActionsInput {
  quotes: Quote[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  accounts?: Account[];
  today?: Date;
}

/** The prioritised to-do list, most costly problem first. */
export function buildNextActions(input: NextActionsInput): NextAction[] {
  const today = input.today ?? new Date();
  const { quotes, invoices, purchaseOrders } = input;
  const out: NextAction[] = [];

  // 1. Accepted work that was never billed — money earned but not asked for.
  const acceptedUnbilled = quotes.filter(
    (q) => q.status === "accepted" && invoicesForQuote(q, invoices).length === 0,
  );
  if (acceptedUnbilled.length) {
    out.push({
      id: "accepted-unbilled",
      tone: "urgent",
      title: `Invoice ${acceptedUnbilled.length} accepted quotation${acceptedUnbilled.length > 1 ? "s" : ""}`,
      why: "The client said yes but you never asked for the money. Nothing gets paid until an invoice exists.",
      count: acceptedUnbilled.length,
      amountMGA: acceptedUnbilled.reduce((s, q) => s + toMGA(quotePayable(q), q.currency), 0),
      to: "/quotations",
      search: { focus: acceptedUnbilled[0]!.id },
      cta: "Create the invoices",
    });
  }

  // 2. Badly late invoices.
  const veryLate = invoices.filter((i) => open(i) && days(i.dueDate, today) > 30 && invoiceBalance(i) > 0);
  if (veryLate.length) {
    out.push({
      id: "overdue-30",
      tone: "urgent",
      title: `Chase ${veryLate.length} invoice${veryLate.length > 1 ? "s" : ""} more than 30 days late`,
      why: "This money was due over a month ago. The longer you wait, the harder it gets to collect.",
      count: veryLate.length,
      amountMGA: veryLate.reduce((s, i) => s + toMGA(invoiceBalance(i), i.currency), 0),
      to: "/invoices",
      search: { focus: veryLate[0]!.id },
      cta: "Follow up now",
    });
  }

  // 3. Recently late invoices.
  const late = invoices.filter((i) => {
    const d = days(i.dueDate, today);
    return open(i) && d > 0 && d <= 30 && invoiceBalance(i) > 0;
  });
  if (late.length) {
    out.push({
      id: "overdue-30-or-less",
      tone: "attention",
      title: `Send a reminder for ${late.length} late invoice${late.length > 1 ? "s" : ""}`,
      why: "Payment date has passed. A short reminder now usually avoids a real collection problem later.",
      count: late.length,
      amountMGA: late.reduce((s, i) => s + toMGA(invoiceBalance(i), i.currency), 0),
      to: "/invoices",
      search: { focus: late[0]!.id },
      cta: "Send reminders",
    });
  }

  // 4. Draft invoices sitting in the app.
  const drafts = invoices.filter((i) => i.status === "draft");
  if (drafts.length) {
    out.push({
      id: "draft-invoices",
      tone: "attention",
      title: `Review and send ${drafts.length} draft invoice${drafts.length > 1 ? "s" : ""}`,
      why: "A draft invoice is only inside Axel — the client has not received it, so the clock has not started.",
      count: drafts.length,
      amountMGA: drafts.reduce((s, i) => s + toMGA(invoicePayable(i), i.currency), 0),
      to: "/invoices",
      search: { focus: drafts[0]!.id },
      cta: "Review drafts",
    });
  }

  // 5. Invoices without the client's purchase order.
  const poIds = new Set(purchaseOrders.filter((p) => p.status !== "cancelled").map((p) => p.id));
  const noPo = invoices.filter(
    (i) => open(i) && i.status !== "draft" && !i.poWaived && (!i.poId || !poIds.has(i.poId)),
  );
  if (noPo.length) {
    out.push({
      id: "missing-po",
      tone: "attention",
      title: `Attach the purchase order to ${noPo.length} invoice${noPo.length > 1 ? "s" : ""}`,
      why: "A purchase order is the client's written promise to pay. Without it, many clients refuse the invoice.",
      count: noPo.length,
      amountMGA: noPo.reduce((s, i) => s + toMGA(invoicePayable(i), i.currency), 0),
      to: "/purchase-orders",
      cta: "Add the PO",
    });
  }

  // 6. Quotations about to expire.
  const expiring = quotes.filter((q) => {
    if (q.status !== "sent") return false;
    const left = -days(q.validUntil, today);
    return left >= 0 && left <= 7;
  });
  if (expiring.length) {
    out.push({
      id: "expiring-quotes",
      tone: "attention",
      title: `Follow up ${expiring.length} quotation${expiring.length > 1 ? "s" : ""} expiring this week`,
      why: "Once the validity date passes you have to re-price and re-send. A phone call now can close it.",
      count: expiring.length,
      amountMGA: expiring.reduce((s, q) => s + toMGA(quotePayable(q), q.currency), 0),
      to: "/quotations",
      search: { focus: expiring[0]!.id },
      cta: "Call the client",
    });
  }

  // 7. Quotations never sent.
  const unsent = quotes.filter((q) => q.status === "draft");
  if (unsent.length) {
    out.push({
      id: "unsent-quotes",
      tone: "routine",
      title: `Send ${unsent.length} draft quotation${unsent.length > 1 ? "s" : ""}`,
      why: "These offers were prepared but never reached the client, so they cannot win any business yet.",
      count: unsent.length,
      amountMGA: unsent.reduce((s, q) => s + toMGA(quotePayable(q), q.currency), 0),
      to: "/quotations",
      search: { focus: unsent[0]!.id },
      cta: "Send them",
    });
  }

  // 8. Bank statements not reconciled recently.
  const stale = (input.accounts ?? []).filter(
    (a) => !a.statementUploadedAt || days(a.statementUploadedAt.slice(0, 10), today) > 35,
  );
  if (stale.length) {
    out.push({
      id: "reconcile",
      tone: "routine",
      title: `Upload a bank statement for ${stale.length} account${stale.length > 1 ? "s" : ""}`,
      why: "Comparing the bank statement with Axel is how you prove the cash balance is real.",
      count: stale.length,
      to: "/accounts",
      cta: "Reconcile",
    });
  }

  const rank: Record<ActionTone, number> = { urgent: 0, attention: 1, routine: 2 };
  return out.sort(
    (a, b) => rank[a.tone] - rank[b.tone] || (b.amountMGA ?? 0) - (a.amountMGA ?? 0),
  );
}

/* ------------------------------------------------------------- cycle stages */

export interface CycleStage {
  key: string;
  label: string;
  /** Plain explanation of what this stage means. */
  hint: string;
  count: number;
  amountMGA: number;
  to: NextAction["to"];
}

/** The money journey: offer → agreement → bill → cash. */
export function buildCycle(input: {
  quotes: Quote[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
}): CycleStage[] {
  const { quotes, invoices, purchaseOrders } = input;
  const qSum = (rows: Quote[]) => rows.reduce((s, q) => s + toMGA(quotePayable(q), q.currency), 0);
  const iSum = (rows: Invoice[], f: (i: Invoice) => number = invoicePayable) =>
    rows.reduce((s, i) => s + toMGA(f(i), i.currency), 0);

  const sent = quotes.filter((q) => q.status === "sent");
  const accepted = quotes.filter((q) => q.status === "accepted");
  const pos = purchaseOrders.filter((p) => p.status !== "cancelled");
  const awaitingPayment = invoices.filter((i) => open(i) && i.status !== "draft");
  const paid = invoices.filter((i) => i.status === "paid");

  return [
    { key: "offer", label: "Offers out", hint: "Quotations the client has received and is thinking about.", count: sent.length, amountMGA: qSum(sent), to: "/quotations" },
    { key: "won", label: "Won", hint: "Quotations the client accepted — this work is yours to deliver and bill.", count: accepted.length, amountMGA: qSum(accepted), to: "/quotations" },
    { key: "po", label: "Purchase orders", hint: "The client's written order confirming they will pay.", count: pos.length, amountMGA: pos.reduce((s, p) => s + toMGA(p.amount, p.currency), 0), to: "/purchase-orders" },
    { key: "billed", label: "Waiting for payment", hint: "Invoices sent to the client and still unpaid.", count: awaitingPayment.length, amountMGA: iSum(awaitingPayment, invoiceBalance), to: "/invoices" },
    { key: "paid", label: "Paid", hint: "Money actually received and matched to an invoice.", count: paid.length, amountMGA: iSum(paid), to: "/invoices" },
  ];
}

/* ------------------------------------------------- per-document next action */

export interface DocNextStep {
  /** What to do, one sentence. */
  step: string;
  /** Who is holding the ball. */
  waitingOn: "you" | "client" | "nobody";
}

export function quoteNextStep(q: Quote, invoices: Invoice[], today: Date = new Date()): DocNextStep {
  switch (q.status) {
    case "draft":
      return { step: "Not sent yet — check the lines and send it to the client.", waitingOn: "you" };
    case "sent": {
      const left = -days(q.validUntil, today);
      if (left < 0) return { step: "Validity has passed — re-price it or mark it expired.", waitingOn: "you" };
      return { step: `Waiting on the client's answer — expires in ${left} day${left === 1 ? "" : "s"}. Follow up.`, waitingOn: "client" };
    }
    case "accepted":
      return invoicesForQuote(q, invoices).length
        ? { step: "Accepted and invoiced — track the payment on the invoice.", waitingOn: "client" }
        : { step: "Accepted but not invoiced — create the invoice so you can get paid.", waitingOn: "you" };
    case "expired":
      return { step: "Expired — re-price and re-send if the client is still interested.", waitingOn: "you" };
    case "rejected":
      return { step: "Rejected — record why, so the next offer is stronger.", waitingOn: "nobody" };
    default:
      return { step: "Cancelled — no further action needed.", waitingOn: "nobody" };
  }
}

export function invoiceNextStep(i: Invoice, today: Date = new Date()): DocNextStep {
  if (i.status === "cancelled") return { step: "Cancelled — no further action needed.", waitingOn: "nobody" };
  if (i.status === "paid") return { step: "Fully paid — link the bank transaction if it is not linked yet.", waitingOn: "nobody" };
  if (i.status === "draft") return { step: "Draft — the client has not received it. Review and send it.", waitingOn: "you" };
  const late = days(i.dueDate, today);
  if (late > 0) return { step: `${late} day${late === 1 ? "" : "s"} late — chase the client and log the follow-up.`, waitingOn: "you" };
  if (i.status === "partial") return { step: "Partly paid — chase the remaining balance.", waitingOn: "client" };
  return { step: `Sent — payment due in ${-late} day${-late === 1 ? "" : "s"}.`, waitingOn: "client" };
}

export function poNextStep(p: PurchaseOrder): DocNextStep {
  if (p.status === "cancelled") return { step: "Cancelled — no further action needed.", waitingOn: "nobody" };
  if (!p.documentUrl) return { step: "No client document attached — upload the PO the client sent you.", waitingOn: "you" };
  if (p.status === "draft") return { step: "Draft — confirm the details, then use it to invoice.", waitingOn: "you" };
  return { step: "Confirmed — you can invoice against this purchase order.", waitingOn: "you" };
}
