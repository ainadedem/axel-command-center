import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface PinInput { companyId: string; employeeId: string; pin: string }
interface PunchInput extends PinInput {
  projectId?: string | null;
  activity?: string | null;
  photoUrl?: string | null;
  gps?: { lat: number; lng: number } | null;
}

const validPin = (pin: string) => /^\d{4,8}$/.test(pin);

/** Sets (or replaces) an employee's kiosk PIN. Company admins/managers only — RLS enforces it. */
export const setKioskPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PinInput) => {
    if (!input?.companyId || !input?.employeeId) throw new Error("Company and employee are required.");
    if (!validPin(input.pin ?? "")) throw new Error("PIN must be 4 to 8 digits.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { hashPin } = await import("./kiosk.server");
    const { supabase } = context as any;
    const { error } = await supabase
      .from("kiosk_credentials")
      .upsert(
        { company_id: data.companyId, employee_id: data.employeeId, pin_hash: hashPin(data.pin) },
        { onConflict: "company_id,employee_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const clearKioskPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; employeeId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("kiosk_credentials").delete()
      .eq("company_id", data.companyId).eq("employee_id", data.employeeId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Kiosk punch: verifies the employee's PIN server-side, then opens or closes
 * their shift. The PIN hash is never exposed to the browser.
 */
export const kioskPunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PunchInput) => {
    if (!input?.companyId || !input?.employeeId) throw new Error("Company and employee are required.");
    if (!validPin(input.pin ?? "")) throw new Error("Enter your PIN.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    // The kiosk operator must actually have access to this company.
    const { data: allowed } = await supabase
      .from("companies").select("id").eq("id", data.companyId).maybeSingle();
    if (!allowed) throw new Error("You do not have access to this company.");

    const { verifyPin } = await import("./kiosk.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cred } = await supabaseAdmin
      .from("kiosk_credentials").select("pin_hash")
      .eq("company_id", data.companyId).eq("employee_id", data.employeeId).maybeSingle();
    if (!cred?.pin_hash || !verifyPin(data.pin, cred.pin_hash)) {
      throw new Error("Incorrect PIN.");
    }

    const { data: open } = await supabaseAdmin
      .from("time_entries").select("id, clock_in")
      .eq("company_id", data.companyId).eq("employee_id", data.employeeId).eq("status", "open")
      .order("clock_in", { ascending: false }).limit(1).maybeSingle();

    const now = new Date().toISOString();

    if (open) {
      const minutes = Math.max(0, Math.round((Date.parse(now) - Date.parse(open.clock_in)) / 60_000));
      const { error } = await supabaseAdmin
        .from("time_entries")
        .update({ clock_out: now, duration_minutes: minutes, status: "closed" })
        .eq("id", open.id);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("time_entry_audit").insert({
        company_id: data.companyId, entry_id: open.id, actor_id: userId,
        actor_name: "Kiosk", action: "kiosk_clock_out", after: { clockOut: now, minutes },
      });
      return { action: "out" as const, minutes };
    }

    const { data: created, error } = await supabaseAdmin
      .from("time_entries")
      .insert({
        company_id: data.companyId,
        employee_id: data.employeeId,
        clock_in: now,
        method: "pin",
        project_id: data.projectId ?? null,
        activity: data.activity ?? null,
        photo_url: data.photoUrl ?? null,
        gps_lat: data.gps?.lat ?? null,
        gps_lng: data.gps?.lng ?? null,
        status: "open",
      })
      .select("id").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("time_entry_audit").insert({
      company_id: data.companyId, entry_id: created.id, actor_id: userId,
      actor_name: "Kiosk", action: "kiosk_clock_in", after: { clockIn: now },
    });
    return { action: "in" as const, minutes: 0 };
  });
