import { createServerFn } from "@tanstack/react-start";
import type { Opportunity, Stage } from "./mock-data";

const NOTION_DB_ID = "b8b031dc-c464-83c8-ae3c-81b113d31f8f";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";

type NotionUser = { id: string; name?: string };
type NotionRichText = { plain_text: string };

interface NotionPage {
  id: string;
  properties: Record<string, any>;
}

const VALID_STAGES: Stage[] = [
  "Lead", "Qualified", "Proposal", "Negotiation", "In progress", "Closed", "Lost",
];

function richTextToString(rt?: NotionRichText[]): string {
  return (rt ?? []).map((t) => t.plain_text).join("").trim();
}

function pickStage(name?: string): Stage {
  if (name && (VALID_STAGES as string[]).includes(name)) return name as Stage;
  return "Lead";
}

export const getNotionDeals = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ deals: Opportunity[]; error: string | null }> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    if (!LOVABLE_API_KEY) return { deals: [], error: "LOVABLE_API_KEY is not configured" };
    if (!NOTION_API_KEY) return { deals: [], error: "Notion is not connected" };

    const headers = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": NOTION_API_KEY,
      "Content-Type": "application/json",
    };

    try {
      // Fetch all pages from the Sales CRM database (paginated).
      const pages: NotionPage[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      let safety = 0;
      while (hasMore && safety < 20) {
        safety++;
        const body: Record<string, unknown> = { page_size: 100 };
        if (cursor) body.start_cursor = cursor;
        const res = await fetch(`${GATEWAY_URL}/databases/${NOTION_DB_ID}/query`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          return { deals: [], error: `Notion API ${res.status}: ${JSON.stringify(data).slice(0, 200)}` };
        }
        pages.push(...(data.results ?? []));
        hasMore = !!data.has_more;
        cursor = data.next_cursor ?? undefined;
      }

      // Resolve customer page titles in a small batch (relations are page IDs).
      const customerIds = new Set<string>();
      for (const p of pages) {
        const rel = p.properties?.["Customer"]?.relation ?? [];
        for (const r of rel) if (r?.id) customerIds.add(r.id);
      }
      const customerNames = new Map<string, string>();
      await Promise.all(
        Array.from(customerIds).map(async (id) => {
          try {
            const r = await fetch(`${GATEWAY_URL}/pages/${id}`, { headers });
            if (!r.ok) return;
            const j = await r.json();
            const props = j.properties ?? {};
            // Find the title property regardless of its name.
            for (const v of Object.values<any>(props)) {
              if (v?.type === "title") {
                customerNames.set(id, richTextToString(v.title));
                break;
              }
            }
          } catch {
            // ignore individual lookup failures
          }
        }),
      );

      const deals: Opportunity[] = pages.map((p) => {
        const props = p.properties ?? {};
        const title = richTextToString(props["Project"]?.title);
        const stage = pickStage(props["Status"]?.status?.name);
        const value = typeof props["Value (MGA)"]?.number === "number" ? props["Value (MGA)"].number : 0;
        const expected = props["Expected Close"]?.date?.start
          ?? props["Last Contact"]?.date?.start
          ?? new Date().toISOString().slice(0, 10);
        const closerPeople: NotionUser[] = props["Deal Closer"]?.people ?? [];
        const closer = closerPeople.map((u) => u.name).filter(Boolean).join(", ");
        const customerRel = props["Customer"]?.relation ?? [];
        const client = customerRel.map((r: { id: string }) => customerNames.get(r.id)).filter(Boolean).join(", ")
          || "—";

        return {
          id: `notion:${p.id}`,
          companyId: "notion",
          name: title || "(Untitled)",
          client,
          closer: closer || undefined,
          stage,
          value,
          currency: "MGA",
          expectedClose: String(expected).slice(0, 10),
        };
      });

      return { deals, error: null };
    } catch (e) {
      console.error("getNotionDeals failed", e);
      return { deals: [], error: e instanceof Error ? e.message : "Unknown error" };
    }
  },
);
