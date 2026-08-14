/**
 * Standard Operating Procedures — registry + compliance engine.
 *
 * SOPs are versioned documents rendered on the SOPs page. Each SOP may declare
 * machine-checkable rules; the compliance dashboard evaluates them against live
 * data so violations surface before they become collection problems.
 */

import { differenceInDays, parseISO } from "date-fns";
import type { Invoice, PurchaseOrder, Expense, PvrRecord, InvoiceEscalation } from "@/lib/mock-data";

/* ─── SOP documents ─────────────────────────────────────────────────── */

export interface SopSection {
  heading: string;
  /** Paragraphs and bullet lines. A line starting with "- " renders as a bullet. */
  body: string[];
}

export interface SopDoc {
  id: string;
  code: string;
  title: string;
  version: string;
  effectiveDate: string;
  owner: string;
  purpose: string;
  scope: string;
  sections: SopSection[];
}

export const SOPS: SopDoc[] = [
  {
    id: "sop-ops-fin-002",
    code: "SOP-OPS-FIN-002",
    title: "Invoicing & Accounts Receivable Governance",
    version: "1.0",
    effectiveDate: "2026-01-01",
    owner: "Finance & Operations",
    purpose:
      "Guarantee that every franc invoiced is backed by an authorised purchase order, a signed completion certificate, and a provable handover date — so collections never stall on a documentation gap.",
    scope:
      "All client invoices, purchase orders, completion certificates (PVR / JCC) and supplier disbursements across every company in the group.",
    sections: [
      {
        heading: "1. Purchase order gating",
        body: [
          "No work starts and no invoice is issued without a client purchase order recorded in the system.",
          "- The client PO code must be captured verbatim as it appears on the client document.",
          "- Invoicing before PO receipt requires an explicit waiver with a written reason; the invoice is then flagged \"PO missing\" until the PO is attached.",
          "- A waived invoice is not eligible for escalation beyond Day 15 until the PO is regularised.",
        ],
      },
      {
        heading: "2. Buying legal entity",
        body: [
          "Client groups often invoice through several legal entities. The buying entity on the PO drives the entity printed on the invoice.",
          "- Record the exact buying legal entity on every purchase order.",
          "- An invoice addressed to the wrong entity is rejected at ingestion and restarts the payment clock — treat a mismatch as a blocking defect.",
        ],
      },
      {
        heading: "3. Completion certificates (PVR / JCC)",
        body: [
          "Every delivered engagement is closed with a Procès-Verbal de Réception or Job Completion Certificate signed by the client.",
          "- The PVR must declare 100% realised service. A partial percentage blocks final invoicing.",
          "- Capture the signature date, the signing team leads and the client SCM coordinator.",
          "- The signed scan is archived against the invoice; an invoice without an attached 100% PVR is non-compliant.",
        ],
      },
      {
        heading: "4. Ingestion date & handover proof",
        body: [
          "Payment terms run from the date the invoice actually enters the client's processing system — not the date we printed it.",
          "- Record the ingestion date on every issued invoice.",
          "- Hard copies are delivered to the client receiving desk and returned stamped; the stamped scan is the handover proof.",
          "- Record who delivered the copy and when it was stamped.",
          "- If the issue date differs from the ingestion date, record a dating note explaining the gap.",
        ],
      },
      {
        heading: "5. Accounts receivable escalation ladder",
        body: [
          "Aging is measured from the ingestion date. Each stage must be logged with the action taken.",
          "- Day 15 — courtesy confirmation that the invoice is booked and scheduled.",
          "- Day 30 — written follow-up to the client finance contact, copying the project sponsor.",
          "- Day 45 — formal reminder to the client's finance manager with the PVR and handover proof attached.",
          "- Day 60 — escalation to executive sponsors; new work for the client is suspended pending settlement.",
        ],
      },
      {
        heading: "6. Payables & disbursement controls",
        body: [
          "Outflows follow fixed cycles so cash is never committed ahead of collection.",
          "- Thursday cycle — independent creative consultants and digital talent retainers are paid on the weekly Thursday run.",
          "- Back-to-back — talent micro-contracts are released only once the funding client invoice is collected.",
          "- Medical — verified consultant medical claims are reimbursed at 80% in the monthly batch.",
          "- Overhead — fixed monthly subscriptions are cleared before month end.",
        ],
      },
      {
        heading: "7. Monitoring",
        body: [
          "The compliance dashboard on this page evaluates every rule above in real time. Violations are reviewed weekly by Finance & Operations and exported for the group tracking sheet.",
        ],
      },
    ],
  },
];

/* ─── Compliance engine ─────────────────────────────────────────────── */

export type Severity = "critical" | "warning";

export interface Violation {
  ruleId: string;
  ruleLabel: string;
  severity: Severity;
  /** Document type the violation belongs to. */
  entity: "invoice" | "purchase_order" | "expense";
  entityId: string;
  /** Human reference, e.g. invoice number. */
  reference: string;
  detail: string;
  companyId: string;
  /** Client the flagged document belongs to, when known. */
  clientId?: string;
  amount?: number;
  currency?: string;
}


export interface ComplianceInput {
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  expenses: Expense[];
  pvrs: PvrRecord[];
  escalations: InvoiceEscalation[];
}

/** Stages of the AR ladder, in days from ingestion. */
export const ESCALATION_STAGES = [15, 30, 45, 60] as const;

export const STAGE_ACTIONS: Record<number, string> = {
  15: "Courtesy confirmation — invoice booked and scheduled",
  30: "Written follow-up to client finance contact",
  45: "Formal reminder with PVR and handover proof",
  60: "Executive escalation — new work suspended",
};

/** Reference date an invoice's aging clock runs from. */
export const agingStart = (inv: Invoice) => inv.ingestionDate || inv.issueDate;

/** Days elapsed since the aging clock started. */
export function agingDays(inv: Invoice, today = new Date()): number {
  const start = agingStart(inv);
  if (!start) return 0;
  return differenceInDays(today, parseISO(start));
}

/** Highest ladder stage the invoice has reached, or 0 when not yet due. */
export function dueStage(inv: Invoice, today = new Date()): number {
  const d = agingDays(inv, today);
  let stage = 0;
  for (const s of ESCALATION_STAGES) if (d >= s) stage = s;
  return stage;
}

const isOpen = (i: Invoice) =>
  i.status !== "cancelled" && i.status !== "draft" && i.amount - i.paid > 0.5;

export function evaluateCompliance(input: ComplianceInput, today = new Date()): Violation[] {
  const { invoices, purchaseOrders, expenses, pvrs, escalations } = input;
  const out: Violation[] = [];
  const poById = new Map(purchaseOrders.map((p) => [p.id, p]));
  const pvrByInvoice = new Map<string, PvrRecord[]>();
  for (const p of pvrs) {
    if (!p.invoiceId) continue;
    const arr = pvrByInvoice.get(p.invoiceId) ?? [];
    arr.push(p);
    pvrByInvoice.set(p.invoiceId, arr);
  }
  const stagesByInvoice = new Map<string, Set<number>>();
  for (const e of escalations) {
    const set = stagesByInvoice.get(e.invoiceId) ?? new Set<number>();
    set.add(e.stage);
    stagesByInvoice.set(e.invoiceId, set);
  }

  for (const inv of invoices) {
    if (inv.status === "cancelled" || inv.status === "draft") continue;
    const base = {
      entity: "invoice" as const,
      entityId: inv.id,
      reference: inv.number,
      companyId: inv.companyId,
      clientId: inv.clientId,
      amount: inv.amount - inv.paid,
      currency: inv.currency,
    };


    // §1 PO gating
    if (!inv.poId) {
      out.push({
        ...base,
        ruleId: "po-missing",
        ruleLabel: "Purchase order missing",
        severity: inv.poWaived ? "warning" : "critical",
        detail: inv.poWaived
          ? `Waived: ${inv.poWaiverReason || "no reason recorded"} — regularise the PO.`
          : "Issued without a client purchase order and without a waiver.",
      });
    } else {
      // §2 buying entity
      const po = poById.get(inv.poId);
      if (po && !po.buyingEntity) {
        out.push({
          ...base,
          ruleId: "buying-entity-missing",
          ruleLabel: "Buying legal entity not recorded",
          severity: "warning",
          detail: `PO ${po.number} has no buying legal entity — invoice may be addressed to the wrong entity.`,
        });
      }
    }

    // §3 PVR
    const linked = pvrByInvoice.get(inv.id) ?? [];
    if (linked.length === 0) {
      out.push({
        ...base,
        ruleId: "pvr-missing",
        ruleLabel: "Completion certificate missing",
        severity: "critical",
        detail: "No signed PVR / JCC attached to this invoice.",
      });
    } else if (!linked.some((p) => p.completionPct >= 100)) {
      const best = Math.max(...linked.map((p) => p.completionPct));
      out.push({
        ...base,
        ruleId: "pvr-partial",
        ruleLabel: "Completion certificate below 100%",
        severity: "critical",
        detail: `Highest declared realisation is ${best}% — final invoicing is blocked until 100%.`,
      });
    }

    // §4 ingestion & handover
    if (!inv.ingestionDate) {
      out.push({
        ...base,
        ruleId: "ingestion-missing",
        ruleLabel: "Ingestion date not recorded",
        severity: "critical",
        detail: "Payment terms cannot be enforced without the client ingestion date.",
      });
    } else if (inv.ingestionDate !== inv.issueDate && !inv.datingNote) {
      out.push({
        ...base,
        ruleId: "dating-note-missing",
        ruleLabel: "Dating gap unexplained",
        severity: "warning",
        detail: `Issued ${inv.issueDate} but ingested ${inv.ingestionDate} with no dating note.`,
      });
    }
    if (!inv.handoverProofUrl) {
      out.push({
        ...base,
        ruleId: "handover-missing",
        ruleLabel: "Stamped handover proof missing",
        severity: "warning",
        detail: "No stamped receiving-desk scan archived for this invoice.",
      });
    }

    // §5 escalation ladder
    if (isOpen(inv)) {
      const stage = dueStage(inv, today);
      if (stage > 0) {
        const done = stagesByInvoice.get(inv.id) ?? new Set<number>();
        const missing = ESCALATION_STAGES.filter((s) => s <= stage && !done.has(s));
        if (missing.length) {
          out.push({
            ...base,
            ruleId: "escalation-overdue",
            ruleLabel: "Escalation step not logged",
            severity: stage >= 45 ? "critical" : "warning",
            detail: `${agingDays(inv, today)} days outstanding — missing day ${missing.join(", ")} action${missing.length > 1 ? "s" : ""}.`,
          });
        }
      }
    }
  }

  // §2 PO-level buying entity (also flag POs never invoiced yet)
  for (const po of purchaseOrders) {
    if (po.buyingEntity) continue;
    if (invoices.some((i) => i.poId === po.id)) continue; // already reported above
    out.push({
      ruleId: "buying-entity-missing",
      ruleLabel: "Buying legal entity not recorded",
      severity: "warning",
      entity: "purchase_order",
      entityId: po.id,
      reference: po.number,
      companyId: po.companyId,
      clientId: po.clientId,
      amount: po.amount,
      currency: po.currency,

      detail: "Purchase order has no buying legal entity recorded.",
    });
  }

  // §6 payables controls
  for (const e of expenses) {
    if (e.status === "paid" || e.status === "cancelled") continue;
    const ref = e.number || e.payee || "Expense";
    if (!e.paymentCycle) {
      out.push({
        ruleId: "cycle-missing",
        ruleLabel: "Disbursement cycle not set",
        severity: "warning",
        entity: "expense",
        entityId: e.id,
        reference: ref,
        companyId: e.companyId,
        amount: e.amount - e.paid,
        currency: e.currency,
        detail: "Every open payable must declare its disbursement rule.",
      });
      continue;
    }
    if (e.paymentCycle === "back_to_back" && !e.fundingInvoiceId) {
      out.push({
        ruleId: "funding-missing",
        ruleLabel: "Back-to-back payout without funding invoice",
        severity: "critical",
        entity: "expense",
        entityId: e.id,
        reference: ref,
        companyId: e.companyId,
        amount: e.amount - e.paid,
        currency: e.currency,
        detail: "Link the client invoice whose collection funds this payout.",
      });
    }
    if (e.paymentCycle === "medical" && (e.reimbursablePct ?? 0) !== 80) {
      out.push({
        ruleId: "medical-pct",
        ruleLabel: "Medical claim not at 80%",
        severity: "warning",
        entity: "expense",
        entityId: e.id,
        reference: ref,
        companyId: e.companyId,
        amount: e.amount - e.paid,
        currency: e.currency,
        detail: `Reimbursable share is ${e.reimbursablePct ?? 0}% — corporate tier is 80%.`,
      });
    }
  }

  return out;
}
