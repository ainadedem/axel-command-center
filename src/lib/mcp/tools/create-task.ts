import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Create task",
  description: "Create a task in a company, optionally assigned to the signed-in user and linked to a client or project.",
  inputSchema: {
    company_id: z.string().uuid().describe("Company id from list_companies."),
    title: z.string().trim().min(1).describe("Short task title."),
    notes: z.string().trim().optional().describe("Optional longer description."),
    status: z.enum(["todo", "doing", "blocked", "done"]).default("todo"),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    due_date: z.string().date().optional().describe("Due date (YYYY-MM-DD)."),
    assign_to_me: z.boolean().default(false).describe("Assign the task to the signed-in user."),
    client_id: z.string().uuid().optional().describe("Client id from list_clients."),
    project_id: z.string().uuid().optional().describe("Project id from list_projects."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const userId = ctx.getUserId();
    if (!userId) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        company_id: input.company_id,
        title: input.title,
        notes: input.notes ?? null,
        status: input.status ?? "todo",
        priority: input.priority ?? "normal",
        due_date: input.due_date ?? null,
        assigned_to: input.assign_to_me ? [userId] : [],
        client_id: input.client_id ?? null,
        project_id: input.project_id ?? null,
        created_by: userId,
      })
      .select("id, company_id, title, status, priority, due_date, assigned_to")
      .single();
    if (error) return toolError(error.message);
    return jsonResult({ task: data });
  },
});
