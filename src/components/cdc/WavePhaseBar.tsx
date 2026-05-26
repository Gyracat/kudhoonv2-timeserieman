export function WavePhaseBar({ phase }: { phase: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-wave">≋ Wave Phase: W3</span>
      <div className="flex items-center gap-2 flex-1 max-w-[60%]">
        <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-wave transition-all"
            style={{ width: `${Math.max(0, Math.min(100, phase))}%` }}
          />
        </div>
        <span className="text-wave font-medium tabular-nums w-10 text-right">{phase}%</span>
      </div>
    </div>
  );
}
