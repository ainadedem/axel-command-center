import { describe, expect, it } from "vitest";
import {
  EXPORT_BODY_FONT,
  EXPORT_FONT_LINKS,
  EXPORT_HEADING_FONT,
  EXPORT_TYPOGRAPHY_CSS,
} from "@/lib/export-fonts";
import { tableHtml } from "@/lib/table-export";

/**
 * Typography regression check.
 *
 * Fails when an export surface stops resolving headings to Plus Jakarta Sans
 * or body / table / form / chart text to Inter.
 */

const HEADING_SELECTORS = ["h1", "th", "legend", "caption"];
const BODY_SELECTORS = ["body", "td", "label", "input", "svg text"];

function familyFor(css: string, selector: string): string | null {
  for (const block of css.split("}")) {
    const [rawSel, rawDecl] = block.split("{");
    if (!rawSel || !rawDecl) continue;
    const selectors = rawSel.split(",").map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    const m = rawDecl.match(/font-family:\s*([^;]+)/);
    if (m) return m[1]!.trim();
  }
  return null;
}

describe("export typography tokens", () => {
  it("maps every heading selector to Plus Jakarta Sans", () => {
    for (const sel of HEADING_SELECTORS) {
      expect(familyFor(EXPORT_TYPOGRAPHY_CSS, sel), `missing family for ${sel}`).toBe(EXPORT_HEADING_FONT);
      expect(EXPORT_HEADING_FONT).toContain("Plus Jakarta Sans");
    }
  });

  it("maps body, table cell, form and chart text to Inter", () => {
    for (const sel of BODY_SELECTORS) {
      expect(familyFor(EXPORT_TYPOGRAPHY_CSS, sel), `missing family for ${sel}`).toBe(EXPORT_BODY_FONT);
      expect(EXPORT_BODY_FONT).toContain("Inter");
    }
  });

  it("loads both families from the same stylesheet", () => {
    expect(EXPORT_FONT_LINKS).toContain("Plus+Jakarta+Sans");
    expect(EXPORT_FONT_LINKS).toContain("Inter");
  });
});

describe("table export document", () => {
  const html = tableHtml(
    "Invoices",
    "3 rows",
    [
      { key: "number", label: "Number", width: 120 },
      { key: "total", label: "Total", width: 90, align: "right" },
    ],
    [{ number: "INV-001", total: "1 200 000 MGA" }],
  );

  it("embeds the shared font links and typography tokens", () => {
    expect(html).toContain("Plus+Jakarta+Sans");
    expect(html).toContain(EXPORT_HEADING_FONT);
    expect(html).toContain(EXPORT_BODY_FONT);
  });

  it("never falls back to a bare system stack for headings or cells", () => {
    expect(html).not.toMatch(/font-family:\s*(Helvetica|Arial|serif)\s*;/i);
  });

  it("keeps on-screen column proportions in the exported table", () => {
    // 120px vs a 130px floor on the right-aligned numeric column.
    expect(html).toContain('width:48.00%');
    expect(html).toContain('width:52.00%');
  });
});
