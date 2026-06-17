import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Scanned invoices live in a PRIVATE Supabase Storage bucket. They are only
// served back through the authed /uploads/[name] route, never via a public URL.
const BUCKET = process.env.SUPABASE_BUCKET || "invoices";

let cached: SupabaseClient | null | undefined;

function admin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}

/** Store an uploaded scan. Returns true on success, false if storage isn't configured. */
export async function uploadInvoiceFile(
  objectName: string,
  bytes: Buffer,
  contentType: string
): Promise<boolean> {
  const sb = admin();
  if (!sb) return false;
  const { error } = await sb.storage.from(BUCKET).upload(objectName, bytes, {
    contentType,
    upsert: true,
  });
  if (error) console.error("Supabase upload failed:", error.message);
  return !error;
}

/** Fetch a stored scan back for the authed viewer. */
export async function downloadInvoiceFile(
  objectName: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const sb = admin();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(BUCKET).download(objectName);
  if (error || !data) return null;
  return {
    bytes: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || "application/octet-stream",
  };
}
