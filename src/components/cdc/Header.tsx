import { Link } from "@tanstack/react-router";
import { Settings, Activity } from "lucide-react";
import { SearchBox } from "./SearchBox";

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
          <span className="text-sm">CDC Wave + Time Serie (Beta)</span?
        </Link>
        {showSearch && <SearchBox />}
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
