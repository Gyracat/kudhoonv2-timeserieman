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

export const unsubscribeAlerts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("alert_subscribers")
      .update({ active: false })
      .eq("email", data.email);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
