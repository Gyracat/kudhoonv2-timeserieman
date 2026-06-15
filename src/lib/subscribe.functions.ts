import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const subscribeSchema = z.object({
  email: z.string().trim().email().max(255),
  tickers: z.array(z.string().trim().toUpperCase().min(1).max(20)).max(50).default([]),
});

export const subscribeAlerts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subscribeSchema.parse(d))
  .handler(async ({ data }) => {
    const { email, tickers } = data;
    // Upsert manually: if email exists, update tickers + reactivate
    const { data: existing } = await supabaseAdmin
      .from("alert_subscribers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("alert_subscribers")
        .update({ tickers, active: true })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, updated: true };
    }
    const { error } = await supabaseAdmin
      .from("alert_subscribers")
      .insert({ email, tickers, active: true });
    if (error) throw new Error(error.message);
    return { ok: true, updated: false };
  });

/**
 * Generate an HMAC-SHA256 unsubscribe token for a given email.
 * Server-only helper — used when composing alert emails so each message
 * can include a verified one-click unsubscribe link.
 */
export async function generateUnsubscribeToken(email: string): Promise<string> {
  const { createHmac } = await import("crypto");
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}

export const unsubscribeAlerts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        token: z.string().trim().min(32).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const secret = process.env.UNSUBSCRIBE_SECRET;
    if (!secret) {
      // Fail closed: never allow unsubscribe without configured secret.
      throw new Error("Unsubscribe is not available");
    }
    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", secret).update(data.email).digest("hex");
    const a = Buffer.from(data.token, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Invalid unsubscribe token");
    }
    const { error } = await supabaseAdmin
      .from("alert_subscribers")
      .update({ active: false })
      .eq("email", data.email);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
