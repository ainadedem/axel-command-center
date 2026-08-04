import { useEffect, useState } from "react";
import { resolveFileUrl } from "@/lib/storage";

/**
 * Resolves a stored file value (`storage:bucket/path`, data URL, or plain URL)
 * into a URL usable by <img> / <a>. Returns undefined while resolving.
 */
export function useFileUrl(value?: string | null): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    value && !value.startsWith("storage:") ? value : undefined,
  );

  useEffect(() => {
    let active = true;
    if (!value) { setUrl(undefined); return; }
    if (!value.startsWith("storage:")) { setUrl(value); return; }
    resolveFileUrl(value).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [value]);

  return url;
}
