import { Check } from "lucide-react";

/**
 * "By the end of this week you can" learning-objectives checklist, shown inside
 * the week Overview for students, parents, and tutors. Objectives are stored as
 * one-per-line admin-set text on the subject week; blank lines are ignored, and
 * the whole block renders nothing when there are no objectives.
 */
export function WeekObjectives({ objectives }: { objectives: string | null }) {
  const items = (objectives ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="rounded-[14px] border border-line bg-surface-2 p-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-600">
        By the end of this week you can
      </div>
      <div className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] bg-brand-50 text-brand-600"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="text-[13.5px] font-semibold leading-snug text-ink">
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
