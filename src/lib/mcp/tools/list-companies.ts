import { defineTool } from "@lovable.dev/mcp-js";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_companies",
  title: "List companies",
  description:
    "List the AXEL companies the signed-in user can access, with their id, code, name and base currency. Use the returned id as company_id for the other tools.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("companies")
      .select("id, code, name, legal_name, base_currency, is_demo")
      .order("name");
    if (error) return toolError(error.message);
    return jsonResult({ companies: data ?? [] });
  },
});
