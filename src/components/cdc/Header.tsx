import { Link } from "@tanstack/react-router";
import { Settings, Activity, LogOut } from "lucide-react";
import { toast } from "sonner";
import { SearchBox } from "./SearchBox";
import { signInWithGoogle, signOut, useSession } from "@/lib/auth";

function AuthButton() {
  const { user, loading } = useSession();
  if (loading) return null;
  if (!user) {
    return (
      <button
        onClick={async () => {
          const { error } = await signInWithGoogle();
          if (error) toast.error(error);
        }}
        className="text-xs px-2.5 py-1.5 rounded bg-pink text-background font-medium"
      >
        Google Login
      </button>
    );
  }
  const avatar = user.user_metadata?.avatar_url as string | undefined;
  return (
    <div className="flex items-center gap-1">
      {avatar ? (
        <img src={avatar} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-xs text-muted-foreground max-w-28 truncate">{user.email}</span>
      )}
      <button
        onClick={() => signOut()}
        className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        aria-label="ออกจากระบบ"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

export function Header({
  search,
  onSearch,
  showSearch = true,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  showSearch?: boolean;
}) {
  // legacy local-filter props kept for compatibility but ignored
  void search;
  void onSearch;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="grid place-items-center size-7 rounded bg-buy/20 text-buy">
            <Activity className="size-4" />
          </span>
          <span className="text-sm">CDC Wave + Time Serie (Beta)</span>
        </Link>
        {showSearch && <SearchBox />}
        <div className="flex-1" />
        <Link
          to="/portfolio"
          className="text-xs px-2.5 py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          พอร์ตทดสอบ
        </Link>
        <AuthButton />
        <Link
          to="/settings"
          className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </header>
  );
}
