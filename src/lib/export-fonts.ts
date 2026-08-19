/**
 * Shared typography contract for every export surface (PDF + printable HTML).
 *
 * All printable documents must resolve to the app pairing:
 *   headings / table headers -> Plus Jakarta Sans
 *   body / cells / forms / chart text -> Inter
 *
 * The same constants are asserted by the typography regression check
 * (`src/lib/__tests__/export-typography.test.ts`), so a builder that forgets
 * the pairing fails the test instead of silently printing Helvetica.
 */

export const EXPORT_HEADING_FONT = `'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif`;
export const EXPORT_BODY_FONT = `'Inter', system-ui, -apple-system, sans-serif`;

export const EXPORT_FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap";

/** `<head>` markup every export document embeds (network path / fallback). */
export const EXPORT_FONT_LINKS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  `<link rel="stylesheet" href="${EXPORT_FONT_CSS_URL}">`,
].join("\n");

/**
 * Baseline family mapping. Emitted first in every export stylesheet so a
 * builder can still override sizes/weights afterwards, but never the family.
 */
export const EXPORT_TYPOGRAPHY_CSS = `
  h1, h2, h3, h4, h5, h6, th, legend, caption, .doc-title, .doc-heading {
    font-family: ${EXPORT_HEADING_FONT};
  }
  html, body, p, td, li, span, div, label, input, select, textarea, table, .chart-text, svg text {
    font-family: ${EXPORT_BODY_FONT};
  }
`;

/** Faces that must be resolved before a snapshot is taken. */
export const EXPORT_FONT_FACES = [
  '400 12px "Inter"',
  '500 12px "Inter"',
  '600 12px "Inter"',
  '700 12px "Inter"',
  '600 12px "Plus Jakarta Sans"',
  '700 12px "Plus Jakarta Sans"',
  '800 28px "Plus Jakarta Sans"',
];

/* ------------------------------------------------------------------
   Fetch + cache: the Google stylesheet and its woff2 files are inlined
   as data URLs once per session, so repeated exports never touch the
   network and always rasterize with the exact same faces.
   ------------------------------------------------------------------ */

const CACHE_KEY = "axel.export.fonts.v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let memoryCss: string | null = null;
let inflight: Promise<string> | null = null;

function readSessionCache(): string | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; css: string };
    if (!parsed?.css || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.css;
  } catch {
    return null;
  }
}

function writeSessionCache(css: string) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), css }));
  } catch {
    /* quota / privacy mode — memory cache still applies */
  }
}

async function toDataUrl(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal, mode: "cors", cache: "force-cache" });
  if (!res.ok) throw new Error(`font ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return `data:font/woff2;base64,${btoa(bin)}`;
}

/**
 * Returns `@font-face` CSS with the woff2 payloads inlined, or `""` when the
 * fonts cannot be fetched in time. Never rejects and never blocks an export:
 * callers fall back to the `<link>` tag + system stack.
 */
export async function getInlineFontCss(timeoutMs = 4000): Promise<string> {
  if (typeof window === "undefined") return "";
  if (memoryCss !== null) return memoryCss;
  const cached = readSessionCache();
  if (cached !== null) {
    memoryCss = cached;
    return cached;
  }
  if (inflight) return inflight;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  inflight = (async () => {
    try {
      const res = await fetch(EXPORT_FONT_CSS_URL, {
        signal: controller.signal,
        cache: "force-cache",
        headers: { Accept: "text/css" },
      });
      if (!res.ok) throw new Error(`css ${res.status}`);
      let css = await res.text();
      const urls = Array.from(new Set(Array.from(css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)).map((m) => m[1]!)));
      const pairs = await Promise.all(
        urls.map(async (u) => {
          try {
            return [u, await toDataUrl(u, controller.signal)] as const;
          } catch {
            return [u, null] as const;
          }
        }),
      );
      for (const [u, data] of pairs) if (data) css = css.split(u).join(data);
      memoryCss = css;
      writeSessionCache(css);
      return css;
    } catch {
      memoryCss = "";
      return "";
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
  })();

  return inflight;
}

/** Warms the cache in the background (safe to call repeatedly). */
export function prewarmExportFonts() {
  void getInlineFontCss().catch(() => undefined);
}
