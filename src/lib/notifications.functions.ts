import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FanOutInput } from "./notifications.types";

export type { FanOutInput };

/**
 * Delivers one event to everyone who should hear about it. The caller is
 * always the actor and is never notified about their own action.
 */
export const pushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FanOutInput) => {
    if (!input?.kind) throw new Error("kind is required");
    if (!input?.title) throw new Error("title is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { fanOut } = await import("./notifications.server");
    const { userId } = context as { userId: string };
    return fanOut(userId, data);
  });
