/**
 * Coloured score pill: green ≥80, brand ≥60, amber below.
 * Accepts a numeric string (e.g. "85") or any string fallback.
 */
export function ScoreBadge({
  score,
  size = "md",
}: {
  score: string;
  size?: "sm" | "md";
}) {
  const num = Number(score);
  const tone =
    num >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : num >= 60
        ? "bg-brand-50 text-brand-700 border-brand-200"
        : "bg-amber-50 text-amber-800 border-amber-200";
  const sizing =
    size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`shrink-0 inline-flex items-center rounded-md font-medium tabular-nums border ${tone} ${sizing}`}
    >
      {Number.isFinite(num) ? `${num}` : score}
    </span>
  );
}
