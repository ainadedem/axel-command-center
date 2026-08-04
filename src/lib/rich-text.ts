/**
 * Light markdown → HTML for printed documents (invoice / quote / PO).
 *
 * Supported: line breaks, bullet lists ("- " / "* "), numbered lists ("1. "),
 * **bold** and *italic*. Everything else is printed verbatim.
 * Input is HTML-escaped FIRST, so the output is always safe to inject.
 */

export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>");
}

/** Renders light markdown to safe HTML. Returns "" for empty input. */
export function renderRichText(raw: unknown): string {
  const text = String(raw ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  const lines = text.split("\n");
  const out: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let para: string[] = [];

  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  const flushPara = () => {
    if (para.length === 0) return;
    out.push(`<div>${para.join("<br/>")}</div>`);
    para = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);

    if (bullet) {
      flushPara();
      if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
      list.items.push(inline(escapeHtml(bullet[1])));
      continue;
    }
    if (numbered) {
      flushPara();
      if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
      list.items.push(inline(escapeHtml(numbered[1])));
      continue;
    }
    flushList();
    if (!trimmed) { flushPara(); continue; }
    para.push(inline(escapeHtml(trimmed)));
  }
  flushList();
  flushPara();
  return out.join("");
}

/** Short hint shown under editable description fields. */
export const RICH_TEXT_HINT = "Multi-line supported — use \"- \" for bullets, \"1. \" for numbers, **bold**, *italic*.";
