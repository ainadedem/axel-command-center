// Role-based permission matrix for AXEL.
// One source of truth — used by nav, route guards, and component-level gating.

export type AppRole =
  | "super_admin"
  | "group_admin"
  | "company_admin"
  | "sales"
  | "finance"
  | "viewer";

export type Resource =
  | "dashboard"
  | "companies"
  | "accounts"
  | "transactions"
  | "invoices"
  | "clients"
  | "projects"
  | "pipeline"
  | "reports";

export type Action = "view" | "edit";

// "edit" implies create / update / delete.
const MATRIX: Record<Resource, Record<AppRole, Action[]>> = {
  dashboard:    { super_admin: ["view", "edit"], group_admin: ["view", "edit"], company_admin: ["view", "edit"], sales: ["view"],          finance: ["view"],          viewer: ["view"] },
  companies:    { super_admin: ["view", "edit"], group_admin: ["view", "edit"], company_admin: ["view"],          sales: [],               finance: ["view"],          viewer: ["view"] },
  accounts:     { super_admin: ["view", "edit"], group_admin: ["view", "edit"], company_admin: ["view", "edit"], sales: [],                finance: ["view", "edit"], viewer: ["view"] },
  transactions: { super_admin: ["view", "edit"], group_admin: ["view", "edit"], company_admin: ["view", "edit"], sales: [],                finance: ["view", "edit"], viewer: ["view"] },
  invoices:     { super_admin: ["view", "edit"], group_admin: ["view", "edit"], company_admin: ["view", "edit"], sales: ["view", "edit"], finance: ["view", "edit"], viewer: ["view"] },
  clients:      { super_admin: ["view", "edit"], group_admin: ["view", "edit"], company_admin: ["view", "edit"], sales: ["view", "edit"], finance: ["view"],          viewer: ["view"] },
  projects:     { super_admin: ["view", "edit"], group_admin: ["view", "edit"], company_admin: ["view", "edit"], sales: ["view", "edit"], finance: ["view"],          viewer: ["view"] },
  pipeline:     { super_admin: ["view", "edit"], group_admin: ["view", "edit"], company_admin: ["view", "edit"], sales: ["view", "edit"], finance: [],                viewer: ["view"] },
  reports:      { super_admin: ["view", "edit"], group_admin: ["view", "edit"], company_admin: ["view"],          sales: ["view"],          finance: ["view", "edit"], viewer: ["view"] },
};

export function can(roles: AppRole[], resource: Resource, action: Action): boolean {
  if (!roles?.length) return false;
  return roles.some((r) => MATRIX[resource]?.[r]?.includes(action));
}

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  group_admin: "Group Admin",
  company_admin: "Company Admin",
  sales: "Sales",
  finance: "Finance",
  viewer: "Viewer",
};

export const ROUTE_RESOURCE: Record<string, Resource> = {
  "/": "dashboard",
  "/companies": "companies",
  "/accounts": "accounts",
  "/transactions": "transactions",
  "/invoices": "invoices",
  "/clients": "clients",
  "/projects": "projects",
  "/pipeline": "pipeline",
  "/reports": "reports",
};
