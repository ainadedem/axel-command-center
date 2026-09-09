import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCompanies from "./tools/list-companies";
import listClients from "./tools/list-clients";
import listInvoices from "./tools/list-invoices";
import listQuotes from "./tools/list-quotes";
import listProjects from "./tools/list-projects";
import listTasks from "./tools/list-tasks";
import createTask from "./tools/create-task";
import updateTask from "./tools/update-task";

// The issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "axel-command",
  title: "AXEL Command",
  version: "0.1.0",
  instructions:
    "Tools for AXEL, the multi-company ERP/CRM of The Axiom Winford Group. Start with `list_companies` to get a company id, then use it to list clients, invoices, quotations, projects and tasks. Tasks can be created and updated. All data is scoped to the signed-in user's company access.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCompanies, listClients, listInvoices, listQuotes, listProjects, listTasks, createTask, updateTask],
});
