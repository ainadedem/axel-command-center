import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "List clients",
  description: "List clients, optionally filtered to one company and/or a name search.",
  inputSchema: {
    company_id: z.string().uuid().optional().describe("Company id from list_companies."),
    search: z.string().trim().min(1).optional().describe("Case-insensitive match on the client name."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("clients")
      .select("id, company_id, name, display_name, email, phone, country, industry, status, payment_terms_days")
      .order("name")
      .limit(limit ?? 50);
    if (company_id) query = query.eq("company_id", company_id);
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) return toolError(error.message);
    return jsonResult({ clients: data ?? [] });
  },
});
