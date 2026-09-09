import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List projects",
  description: "List projects with their client, currency, revenue and cost.",
  inputSchema: {
    company_id: z.string().uuid().optional().describe("Company id from list_companies."),
    client_id: z.string().uuid().optional().describe("Client id from list_clients."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, client_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("projects")
      .select("id, company_id, client_id, name, currency, revenue, cost, created_at")
      .order("name")
      .limit(limit ?? 50);
    if (company_id) query = query.eq("company_id", company_id);
    if (client_id) query = query.eq("client_id", client_id);
    const { data, error } = await query;
    if (error) return toolError(error.message);
    return jsonResult({ projects: data ?? [] });
  },
});
