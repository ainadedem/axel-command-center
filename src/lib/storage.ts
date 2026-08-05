import { supabase } from "@/integrations/supabase/client";

/**
 * File storage helpers.
 *
 * Files used to be embedded in table rows as base64 data URLs, which bloats
 * every row and breaks on larger PDFs. Files now live in private storage
 * buckets and rows only keep a small reference of the form:
 *
 *   storage:<bucket>/<path>
 *
 * Use `resolveFileUrl` to turn that reference into a usable (signed) URL.
 */

export const AVATARS_BUCKET = "avatars";
export const DOCUMENTS_BUCKET = "documents";

const REF_PREFIX = "storage:";
const SIGNED_TTL_SECONDS = 60 * 60; // 1 hour

export const isStorageRef = (value?: string | null): value is string =>
  typeof value === "string" && value.startsWith(REF_PREFIX);

export const isDataUrl = (value?: string | null): boolean =>
  typeof value === "string" && value.startsWith("data:");

function parseRef(ref: string): { bucket: string; path: string } | null {
  const rest = ref.slice(REF_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

function safeName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-90) || "file";
}

/** Uploads a file and returns the `storage:` reference to store on the row. */
export async function uploadFile(bucket: string, folder: string, file: File): Promise<string> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let prefix = folder.replace(/^\/+|\/+$/g, "") || "misc";

  // Avatars are scoped per uploader: storage policies only allow writing into
  // a folder named after the authenticated user's id.
  if (bucket === AVATARS_BUCKET) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("You must be signed in to upload an image");
    prefix = `${data.user.id}/${prefix}`;
  }

  const path = `${prefix}/${stamp}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  return `${REF_PREFIX}${bucket}/${path}`;
}

const signedCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Resolves a stored value to something an <img> or <a> can use.
 * Legacy data URLs and plain http(s) URLs are returned unchanged.
 */
export async function resolveFileUrl(value?: string | null): Promise<string | undefined> {
  if (!value) return undefined;
  if (!isStorageRef(value)) return value;

  const cached = signedCache.get(value);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.url;

  const parsed = parseRef(value);
  if (!parsed) return undefined;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return undefined;

  signedCache.set(value, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_TTL_SECONDS * 1000 });
  return data.signedUrl;
}

/** Best-effort removal — a failed delete never blocks the user's action. */
export async function removeFile(value?: string | null): Promise<void> {
  if (!isStorageRef(value)) return;
  const parsed = parseRef(value);
  if (!parsed) return;
  signedCache.delete(value);
  await supabase.storage.from(parsed.bucket).remove([parsed.path]);
}

/** Opens a stored file in a new tab, resolving the signed URL first. */
export async function openStoredFile(value?: string | null): Promise<boolean> {
  const url = await resolveFileUrl(value);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
