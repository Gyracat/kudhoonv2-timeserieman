import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const lovableAuth = createLovableAuth();

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const result = await lovableAuth.signInWithOAuth("google", {
    redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
  });
  if (result.error) return { error: result.error.message };
  if (result.redirected) return { error: null };
  const { error } = await supabase.auth.setSession({
    access_token: result.tokens!.access_token,
    refresh_token: result.tokens!.refresh_token,
  });
  return { error: error?.message ?? null };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: (session?.user ?? null) as User | null, loading };
}
