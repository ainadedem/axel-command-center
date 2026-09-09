import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "List tasks",
  description: "List team tasks with status, priority, due date and linked client, project or document.",
  inputSchema: {
    company_id: z.string().uuid().optional().describe("Company id from list_companies."),
    status: z.enum(["todo", "doing", "blocked", "done"]).optional().describe("Filter by task status."),
    mine_only: z.boolean().default(false).describe("Only tasks assigned to the signed-in user."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, status, mine_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tasks")
      .select(
        "id, company_id, title, notes, status, priority, due_date, assigned_to, client_id, project_id, quote_id, invoice_id, completed_at, created_at",
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit ?? 50);
    if (company_id) query = query.eq("company_id", company_id);
    if (status) query = query.eq("status", status);
    if (mine_only) {
      const userId = ctx.getUserId();
      if (!userId) return unauthenticated();
      query = query.contains("assigned_to", [userId]);
    }
    const { data, error } = await query;
    if (error) return toolError(error.message);
    return jsonResult({ tasks: data ?? [] });
  },
});
