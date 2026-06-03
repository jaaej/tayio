type Props = {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label?: string;
  labelClass?: string;
};

/** Circular SVG progress ring with optional centered label. */
export function ProgressRing({
  value,
  size = 60,
  stroke = 7,
  color = "var(--brand-500)",
  track = "var(--surface-2)",
  label,
  labelClass,
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div
        className={
          labelClass ||
          "absolute inset-0 grid place-items-center font-extrabold tracking-[-0.02em]"
        }
        style={{ fontSize: size > 80 ? 20 : 14 }}
      >
        {label ?? `${Math.round(value)}%`}
      </div>
    </div>
  );
}
