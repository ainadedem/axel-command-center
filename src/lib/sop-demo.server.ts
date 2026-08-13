/**
 * Demo workspace seeding — server-only. Creates a clearly labelled demo
 * company holding one sample client and a spread of invoices engineered so
 * every SOP-OPS-FIN-002 rule fires at least once. Real companies are never
 * touched: everything lives under the demo company and is removed with it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const DEMO_CODE = "DEMO";
export const DEMO_NAME = "DEMO — Sample Co";

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};
const isoTs = (daysAgo: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};

type Admin = SupabaseClient<any, any, any>;

export interface SeedResult {
  companyId: string;
  invoices: number;
  purchaseOrders: number;
  pvrs: number;
  expenses: number;
}

export async function seedDemo(admin: Admin, userId: string): Promise<SeedResult> {
  // Remove any previous demo run so the seed is idempotent.
  await removeDemo(admin);

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: DEMO_NAME,
      short_name: "Demo",
      code: DEMO_CODE,
      base_currency: "MGA",
      color: "#7c3aed",
      is_demo: true,
      legal_name: "Sample Co SARL (demonstration data)",
      address: "Lot II B 12, Antananarivo 101, Madagascar",
      email: "finance@sample-demo.mg",
      nif: "0000 0000 000",
      stat: "00000 11 2026 0 00000",
      rcs: "2026 B 00000",
      default_document_language: "en",
    })
    .select("id")
    .single();
  if (companyError || !company) throw new Error(companyError?.message ?? "Could not create the demo company");
  const companyId = company.id as string;

  await admin.from("user_company_access").upsert(
    { user_id: userId, company_id: companyId, role: "company_admin" },
    { onConflict: "user_id,company_id" },
  );

  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      company_id: companyId,
      name: "Demo Client Group",
      country: "Madagascar",
      status: "active",
      email: "ap@demo-client.example",
      phone: "+261 20 00 000 00",
      address: "Immeuble Demo, Ankorondrano, Antananarivo",
      industry: "Telecommunications",
      nif: "1111 1111 111",
      stat: "11111 11 2026 0 11111",
      rcs: "2026 B 11111",
    })
    .select("id")
    .single();
  if (clientError || !client) throw new Error(clientError?.message ?? "Could not create the demo client");
  const clientId = client.id as string;

  // Purchase orders — one complete, one missing its buying legal entity.
  const { data: pos, error: poError } = await admin
    .from("purchase_orders")
    .insert([
      {
        company_id: companyId, client_id: clientId, number: "PO/DEMO/001",
        client_reference: "4500123456", issue_date: iso(95), amount: 18_000_000,
        currency: "MGA", status: "accepted", buying_entity: "Demo Client Telecom SA",
        language: "en", created_by: userId,
      },
      {
        company_id: companyId, client_id: clientId, number: "PO/DEMO/002",
        client_reference: "4500123457", issue_date: iso(80), amount: 9_500_000,
        currency: "MGA", status: "accepted", buying_entity: null,
        language: "en", created_by: userId,
      },
      {
        company_id: companyId, client_id: clientId, number: "PO/DEMO/003",
        client_reference: "4500123458", issue_date: iso(50), amount: 12_000_000,
        currency: "MGA", status: "accepted", buying_entity: "Demo Client Media SA",
        language: "en", created_by: userId,
      },
    ])
    .select("id, number");
  if (poError) throw new Error(poError.message);
  const poId = (n: string) => pos?.find((p) => p.number === n)?.id as string | undefined;

  // Invoices — each one demonstrates a different compliance outcome.
  const { data: invoices, error: invError } = await admin
    .from("invoices")
    .insert([
      { // fully compliant
        company_id: companyId, client_id: clientId, po_id: poId("PO/DEMO/001"),
        number: "FAC/DEMO/001", issue_date: iso(20), due_date: iso(-10),
        ingestion_date: iso(20), amount: 18_000_000, paid: 0, currency: "MGA",
        status: "sent", subject: "Brand campaign — phase 1", language: "en",
        handover_proof_url: "demo://handover/FAC-DEMO-001.pdf",
        handover_proof_name: "FAC-DEMO-001-stamped.pdf",
        handover_stamped_at: isoTs(19), handover_by: "Demo courier",
        created_by: userId,
      },
      { // no purchase order at all — critical
        company_id: companyId, client_id: clientId, po_id: null,
        number: "FAC/DEMO/002", issue_date: iso(12), due_date: iso(-18),
        ingestion_date: iso(12), amount: 4_200_000, paid: 0, currency: "MGA",
        status: "sent", subject: "Urgent event support", language: "en",
        created_by: userId,
      },
      { // partial PVR + no handover proof
        company_id: companyId, client_id: clientId, po_id: poId("PO/DEMO/002"),
        number: "FAC/DEMO/003", issue_date: iso(26), due_date: iso(-4),
        ingestion_date: iso(24), amount: 9_500_000, paid: 0, currency: "MGA",
        status: "sent", subject: "Digital retainer — Q2", language: "en",
        dating_note: null, created_by: userId,
      },
      { // 38 days old, only day 15 logged
        company_id: companyId, client_id: clientId, po_id: poId("PO/DEMO/003"),
        number: "FAC/DEMO/004", issue_date: iso(40), due_date: iso(10),
        ingestion_date: iso(38), amount: 12_000_000, paid: 0, currency: "MGA",
        status: "overdue", subject: "Production — TVC delivery", language: "en",
        handover_proof_url: "demo://handover/FAC-DEMO-004.pdf",
        handover_proof_name: "FAC-DEMO-004-stamped.pdf",
        handover_stamped_at: isoTs(37), handover_by: "Demo courier",
        dating_note: "Client receiving desk closed on issue day.",
        created_by: userId,
      },
      { // 72 days old, nothing logged — whole ladder red
        company_id: companyId, client_id: clientId, po_id: poId("PO/DEMO/001"),
        number: "FAC/DEMO/005", issue_date: iso(74), due_date: iso(44),
        ingestion_date: iso(72), amount: 7_800_000, paid: 1_000_000, currency: "MGA",
        status: "overdue", subject: "Media buying — legacy balance", language: "en",
        created_by: userId,
      },
    ])
    .select("id, number");
  if (invError) throw new Error(invError.message);
  const invId = (n: string) => invoices?.find((i) => i.number === n)?.id as string | undefined;

  const { error: pvrError } = await admin.from("pvr_records").insert([
    {
      company_id: companyId, invoice_id: invId("FAC/DEMO/001"), reference: "PVR/DEMO/001",
      signed_date: iso(22), completion_pct: 100, signed_by: "A. Rakoto / D. Randria",
      scm_coordinator: "Demo SCM", created_by: userId,
    },
    {
      company_id: companyId, invoice_id: invId("FAC/DEMO/003"), reference: "PVR/DEMO/003",
      signed_date: iso(27), completion_pct: 60, signed_by: "A. Rakoto",
      scm_coordinator: "Demo SCM", notes: "Second batch pending client sign-off.",
      created_by: userId,
    },
    {
      company_id: companyId, invoice_id: invId("FAC/DEMO/004"), reference: "PVR/DEMO/004",
      signed_date: iso(41), completion_pct: 100, signed_by: "H. Rabe",
      scm_coordinator: "Demo SCM", created_by: userId,
    },
    {
      company_id: companyId, invoice_id: invId("FAC/DEMO/005"), reference: "PVR/DEMO/005",
      signed_date: iso(75), completion_pct: 100, signed_by: "H. Rabe",
      scm_coordinator: "Demo SCM", created_by: userId,
    },
  ]);
  if (pvrError) throw new Error(pvrError.message);

  const { error: escError } = await admin.from("invoice_escalations").insert([
    {
      company_id: companyId, invoice_id: invId("FAC/DEMO/004"), stage: 15,
      action: "Courtesy confirmation — invoice booked and scheduled",
      notes: "Spoke to AP desk; invoice registered under batch 2026-07.",
      performed_at: isoTs(22), performed_by: userId, performed_by_name: "Demo data",
    },
  ]);
  if (escError) throw new Error(escError.message);

  const { error: expError } = await admin.from("expenses").insert([
    {
      company_id: companyId, kind: "bill", payee: "Demo Creative Consultant",
      number: "EXP/DEMO/001", issue_date: iso(6), due_date: iso(-1),
      amount: 2_400_000, paid: 0, currency: "MGA", status: "open",
      description: "Talent micro-contract — funded by client collection",
      payment_cycle: "back_to_back", funding_invoice_id: null, created_by: userId,
    },
    {
      company_id: companyId, kind: "bill", payee: "Demo Medical Claim",
      number: "EXP/DEMO/002", issue_date: iso(9), due_date: iso(6),
      amount: 350_000, paid: 0, currency: "MGA", status: "open",
      description: "Consultant medical reimbursement", payment_cycle: "medical",
      medical_claim: true, reimbursable_pct: 60, created_by: userId,
    },
  ]);
  if (expError) throw new Error(expError.message);

  return { companyId, invoices: invoices?.length ?? 0, purchaseOrders: pos?.length ?? 0, pvrs: 4, expenses: 2 };
}

export async function removeDemo(admin: Admin): Promise<{ removed: number }> {
  const { data: demos, error } = await admin.from("companies").select("id").eq("is_demo", true);
  if (error) throw new Error(error.message);
  const ids = (demos ?? []).map((c) => c.id as string);
  if (ids.length === 0) return { removed: 0 };

  const { data: invoices } = await admin.from("invoices").select("id").in("company_id", ids);
  const invoiceIds = (invoices ?? []).map((i) => i.id as string);
  if (invoiceIds.length) await admin.from("invoice_lines").delete().in("invoice_id", invoiceIds);

  for (const table of [
    "invoice_escalations", "pvr_records", "ar_alert_log", "transactions",
    "invoices", "purchase_orders", "quotes", "expenses", "projects",
    "clients", "accounts", "categories", "budgets", "user_company_access",
  ]) {
    await admin.from(table).delete().in("company_id", ids);
  }
  await admin.from("companies").delete().in("id", ids);
  return { removed: ids.length };
}
