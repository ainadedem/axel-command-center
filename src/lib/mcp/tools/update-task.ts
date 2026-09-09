import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "update_task",
  title: "Update task",
  description: "Update an existing task's title, notes, status, priority or due date.",
  inputSchema: {
    task_id: z.string().uuid().describe("Task id from list_tasks."),
    title: z.string().trim().min(1).optional(),
    notes: z.string().trim().optional(),
    status: z.enum(["todo", "doing", "blocked", "done"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    due_date: z.string().date().optional().describe("Due date (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ task_id, ...fields }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const patch: Record<string, unknown> = {};
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.notes !== undefined) patch.notes = fields.notes;
    if (fields.priority !== undefined) patch.priority = fields.priority;
    if (fields.due_date !== undefined) patch.due_date = fields.due_date;
    if (fields.status !== undefined) {
      patch.status = fields.status;
      patch.completed_at = fields.status === "done" ? new Date().toISOString() : null;
    }
    if (Object.keys(patch).length === 0) return toolError("Nothing to update — provide at least one field.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", task_id)
      .select("id, title, status, priority, due_date, completed_at")
      .single();
    if (error) return toolError(error.message);
    return jsonResult({ task: data });
  },
});
