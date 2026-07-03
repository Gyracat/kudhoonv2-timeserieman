import { Link, useNavigate } from "@tanstack/react-router";
import { Sprout, LogOut, UserRound, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

export function SiteNav() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-user-menu]")) setOpen(false);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Sprout className="size-6 text-forest" />
          <span className="text-forest">Carbon<span className="text-sky">Maps</span></span>
        </Link>
        <div className="hidden gap-7 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/" className="transition hover:text-forest">Home</Link>
          <Link to="/marketplace" className="transition hover:text-forest" activeProps={{ className: "text-forest" }}>Marketplace</Link>
          <Link to="/map" className="transition hover:text-forest" activeProps={{ className: "text-forest" }}>Map</Link>
          <Link to="/standards" className="transition hover:text-forest" activeProps={{ className: "text-forest" }}>Standards</Link>
          <Link to="/donate" className="inline-flex items-center gap-1 font-semibold text-forest transition hover:text-forest-deep" activeProps={{ className: "text-forest-deep" }}>
            <Heart className="size-4 fill-forest text-forest" /> Donate
          </Link>
          {user && (
            <Link to="/app/measure" className="transition hover:text-forest" activeProps={{ className: "text-forest" }}>Measure</Link>
          )}
          {user && (
            <Link to="/app/portfolio" className="transition hover:text-forest" activeProps={{ className: "text-forest" }}>Portfolio</Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <div className="relative" data-user-menu>
              <button onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-deep">
                <UserRound className="size-4" />
                <span className="max-w-[140px] truncate">{user.email}</span>
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg">
                  <Link to="/app/measure" className="block px-4 py-2 text-sm hover:bg-naturebag">Measure Land</Link>
                  <Link to="/app/portfolio" className="block px-4 py-2 text-sm hover:bg-naturebag">My Portfolio</Link>
                  <button onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-naturebag">
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/auth" className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-forest-deep">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white py-8">
      <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
        © 2026 CarbonMaps Protocol. Built for the hackathon · Real-time data from Lovable Cloud + NASA EONET.
      </div>
    </footer>
  );
}