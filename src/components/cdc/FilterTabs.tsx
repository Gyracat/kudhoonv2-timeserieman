import { cn } from "@/lib/utils";

const tabs = [
  { key: "all", label: "All", icon: "" },
  { key: "buy", label: "Buy", icon: "↗" },
  { key: "sell", label: "Sell", icon: "↘" },
  { key: "up", label: "Up", icon: "↑" },
  { key: "w1", label: "W1", icon: "≋" },
  { key: "w2", label: "W2", icon: "≋" },
  { key: "w3", label: "W3", icon: "≋" },
  { key: "fav", label: "Fav", icon: "♡" },
] as const;

export type FilterKey = (typeof tabs)[number]["key"];

export function FilterTabs({
  active,
  counts,
  onChange,
}: {
  active: FilterKey;
  counts: Record<FilterKey, number>;
  onChange: (k: FilterKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const isActive = t.key === active;
        const accent =
          t.key === "buy"
            ? "border-buy text-buy"
            : t.key === "sell"
              ? "border-sell text-sell"
              : t.key === "w3"
                ? "border-wave text-wave"
                : "border-border";
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer",
              "bg-card hover:bg-accent",
              isActive ? accent : "border-border text-muted-foreground",
            )}
          >
            {t.icon && <span className="mr-1">{t.icon}</span>}
            {t.label} ({counts[t.key] ?? 0})
          </button>
        );
      })}
    </div>
  );
}
