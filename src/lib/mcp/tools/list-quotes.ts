import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_quotes",
  title: "List quotations",
  description: "List quotations with amounts, status, validity and follow-up dates.",
  inputSchema: {
    company_id: z.string().uuid().optional().describe("Company id from list_companies."),
    client_id: z.string().uuid().optional().describe("Client id from list_clients."),
    status: z.string().trim().min(1).optional().describe("Quotation status, e.g. draft, sent, accepted, refused."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, client_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("quotes")
      .select(
        "id, company_id, client_id, number, subject, status, currency, amount, tax_amount, total_amount, issue_date, valid_until, sent_at, next_follow_up_at, project_id",
      )
      .order("issue_date", { ascending: false })
      .limit(limit ?? 50);
    if (company_id) query = query.eq("company_id", company_id);
    if (client_id) query = query.eq("client_id", client_id);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return toolError(error.message);
    return jsonResult({ quotes: data ?? [] });
  },
});
