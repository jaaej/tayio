import { cn } from "@/lib/utils";

export type MasteryLevel =
  | "not_started"
  | "needs_work"
  | "improving"
  | "strong";

const MASTERY_TO_PERCENT: Record<MasteryLevel, number> = {
  not_started: 0,
  needs_work: 30,
  improving: 65,
  strong: 92,
};

const MASTERY_COLOR: Record<MasteryLevel, string> = {
  not_started: "bg-hairline",
  needs_work: "bg-amber-500",
  improving: "bg-brand-600",
  strong: "bg-emerald-500",
};

const TRACK = "bg-brand-50";

export function ProgressBar({
  label,
  percent,
  color = "bg-brand-600",
  className,
}: {
  label?: string;
  percent: number;
  color?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("space-y-1.5", className)}>
      {label !== undefined && (
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-ink">{label}</span>
          <span className="text-muted tabular-nums">{clamped}%</span>
        </div>
      )}
      <div className={cn("h-1.5 w-full rounded-full overflow-hidden", TRACK)}>
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function MasteryBar({
  label,
  mastery,
  className,
}: {
  label: string;
  mastery: MasteryLevel;
  className?: string;
}) {
  return (
    <ProgressBar
      label={label}
      percent={MASTERY_TO_PERCENT[mastery]}
      color={MASTERY_COLOR[mastery]}
      className={className}
    />
  );
}
