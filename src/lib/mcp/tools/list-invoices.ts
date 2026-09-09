import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_invoices",
  title: "List invoices",
  description:
    "List invoices with amounts, status, dates and how much has been paid. Filter by company, client, status or issue-date range.",
  inputSchema: {
    company_id: z.string().uuid().optional().describe("Company id from list_companies."),
    client_id: z.string().uuid().optional().describe("Client id from list_clients."),
    status: z.string().trim().min(1).optional().describe("Invoice status, e.g. draft, sent, paid, overdue, cancelled."),
    issued_from: z.string().date().optional().describe("Only invoices issued on or after this date (YYYY-MM-DD)."),
    issued_to: z.string().date().optional().describe("Only invoices issued on or before this date (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, client_id, status, issued_from, issued_to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("invoices")
      .select(
        "id, company_id, client_id, number, subject, status, currency, amount, tax_amount, total_amount, paid, issue_date, due_date, paid_date, project_id",
      )
      .order("issue_date", { ascending: false })
      .limit(limit ?? 50);
    if (company_id) query = query.eq("company_id", company_id);
    if (client_id) query = query.eq("client_id", client_id);
    if (status) query = query.eq("status", status);
    if (issued_from) query = query.gte("issue_date", issued_from);
    if (issued_to) query = query.lte("issue_date", issued_to);
    const { data, error } = await query;
    if (error) return toolError(error.message);
    return jsonResult({ invoices: data ?? [] });
  },
});
