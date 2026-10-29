import { cn } from "@/lib/utils";
import type { KeyNumber } from "@/lib/student-history";

const TONE = { good: "text-good", warn: "text-warn", bad: "text-bad" } as const;

/**
 * A student's four key numbers (`keyNumbers`) as one flat row inside the
 * record's panel, two by two on a phone. Shared by the tutor's Overview and
 * the admin's History tab.
 */
export function KeyNumbers({ items }: { items: KeyNumber[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-5 px-4 py-5 sm:grid-cols-4 sm:px-5">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[12px] font-bold text-muted">{item.label}</dt>
          <dd
            className={cn(
              "text-[22px] font-extrabold leading-tight tabular-nums",
              item.tone ? TONE[item.tone] : "text-ink",
            )}
          >
            {item.value}
          </dd>
          <dd className="text-[12px] text-muted">{item.sub}</dd>
        </div>
      ))}
    </dl>
  );
}
