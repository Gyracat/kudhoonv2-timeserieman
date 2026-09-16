export function Sparkline({
  values,
  up,
  width = 96,
  height = 36,
}: {
  values: number[];
  up: boolean;
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / span) * height).toFixed(2)}`);
  const stroke = up ? "hsl(var(--buy))" : "hsl(var(--sell))";
  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}
