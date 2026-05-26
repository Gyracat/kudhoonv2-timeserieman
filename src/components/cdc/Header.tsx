import { Link } from "@tanstack/react-router";
import { Search, Settings, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";

export function Header({
  search,
  onSearch,
}: {
  search?: string;
  onSearch?: (v: string) => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="grid place-items-center size-7 rounded bg-buy/20 text-buy">
            <Activity className="size-4" />
          </span>
          <span className="text-sm">CDC Wave 3</span>
        </Link>
        {onSearch && (
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search ?? ""}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search ticker..."
              className="pl-8 h-9 bg-card border-border"
            />
          </div>
        )}
        <div className="flex-1" />
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
