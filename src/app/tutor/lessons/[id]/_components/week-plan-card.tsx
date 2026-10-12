import Link from "next/link";
import { Paperclip } from "lucide-react";
import type { LessonWeek } from "@/lib/week-plans";

/**
 * "For students this week", read-only on the lesson page. It is written once
 * per class and week on the Week plan tab; `editHref` is null when this tutor
 * does not own the class (a cover lesson), since that tab would not open.
 */
export function WeekPlanCard({
  week,
  editHref,
}: {
  week: LessonWeek | null;
  editHref: string | null;
}) {
  const body = week?.plan?.body?.trim() ?? "";
  const attachments = week?.plan?.attachments.length ?? 0;
  const hasContent = body.length > 0 || attachments > 0;

  return (
    <section aria-labelledby="week-plan-heading" className="glass flex min-w-0 flex-col rounded-[24px] p-1.5">
      <div className="flex min-h-12 items-center justify-between gap-2 py-1.5 pl-3 pr-1.5">
        <h2 id="week-plan-heading" className="text-[16px] font-extrabold text-ink">
          For students this week
        </h2>
        {editHref && (
          <Link
            href={editHref}
            className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-[8px] px-1.5 text-[13px] font-bold text-brand-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            Edit in week plan
          </Link>
        )}
      </div>
      <div className="panel flex flex-col gap-2 p-3.5 text-[14px] leading-[1.55] text-ink">
        {week && (
          <span className="text-[12px] font-bold text-ink-soft">
            Week {week.weekNumber}
            {week.title ? ` · ${week.title}` : ""}
          </span>
        )}
        {!week ? (
          <p className="text-[13px] text-muted">
            This lesson falls outside the term&apos;s curriculum weeks.
          </p>
        ) : !hasContent ? (
          <p className="text-[13px] text-muted">Nothing written for this week yet.</p>
        ) : (
          <>
            {body && <p className="whitespace-pre-wrap break-words">{body}</p>}
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              {attachments > 0 && (
                <>
                  <Paperclip className="h-3.5 w-3.5" aria-hidden />
                  {attachments} {attachments === 1 ? "attachment" : "attachments"} ·{" "}
                </>
              )}
              Students and parents see this
            </span>
          </>
        )}
      </div>
    </section>
  );
}
