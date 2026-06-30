// Edge Function: send-quote-email
// Accepts a quote id, recipient email, and a PDF (base64).
// Uploads PDF to the `quote-pdfs` bucket at {company_id}/{quote_number}.pdf,
// emails it via Resend as an attachment, then updates the quote row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  quote_id: string;
  recipient_email: string;
  pdf_base64: string; // base64-encoded PDF bytes
  subject?: string;
  message?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "server_misconfigured" }, 500);
  if (!RESEND_API_KEY) return json({ error: "missing_resend_key" }, 500);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { quote_id, recipient_email, pdf_base64, subject, message } = payload ?? {};
  if (!quote_id || !recipient_email || !pdf_base64) {
    return json({ error: "missing_fields", required: ["quote_id", "recipient_email", "pdf_base64"] }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Look up quote
  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .select("id, number, company_id")
    .eq("id", quote_id)
    .maybeSingle();

  if (qErr) return json({ error: "db_error", detail: qErr.message }, 500);
  if (!quote) return json({ error: "quote_not_found" }, 404);

  const pdfBytes = base64ToBytes(pdf_base64);
  const safeNumber = String(quote.number).replace(/[^A-Za-z0-9_.-]/g, "_");
  const objectPath = `${quote.company_id}/${safeNumber}.pdf`;

  // Upload PDF
  const { error: upErr } = await admin.storage
    .from("quote-pdfs")
    .upload(objectPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (upErr) return json({ error: "upload_failed", detail: upErr.message }, 500);

  const { data: pub } = admin.storage.from("quote-pdfs").getPublicUrl(objectPath);
  const pdfUrl = pub?.publicUrl ?? null;

  // Send via Resend
  const emailSubject = subject ?? `Quote ${quote.quote_number}`;
  const emailHtml =
    message ??
    `<p>Hello,</p><p>Please find attached quote <strong>${quote.quote_number}</strong>.</p>`;

  let resendRes: Response;
  try {
    resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Quotes <onboarding@resend.dev>",
        to: [recipient_email],
        subject: emailSubject,
        html: emailHtml,
        attachments: [
          {
            filename: `${quote.quote_number}.pdf`,
            content: pdf_base64.includes(",") ? pdf_base64.split(",")[1] : pdf_base64,
          },
        ],
      }),
    });
  } catch (e) {
    return json({ error: "resend_network_error", detail: String(e) }, 502);
  }

  if (!resendRes.ok) {
    const body = await resendRes.text().catch(() => "");
    return json({ error: "resend_failed", status: resendRes.status, detail: body }, 502);
  }

  const sentAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("quotes")
    .update({ pdf_url: pdfUrl, sent_at: sentAt, sent_to: recipient_email })
    .eq("id", quote_id);

  if (updErr) {
    return json({
      error: "quote_update_failed",
      detail: updErr.message,
      email_sent: true,
      pdf_url: pdfUrl,
    }, 500);
  }

  return json({ ok: true, pdf_url: pdfUrl, sent_at: sentAt, sent_to: recipient_email });
});
