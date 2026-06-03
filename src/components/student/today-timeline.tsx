import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";

export type TimelineItem = {
  time: string;
  duration: string;
  title: string;
  sub: string;
  subjectName: string;
};

/**
 * Compact "Today" timeline — time + bar + title/sub. Bar uses the subject
 * accent colour so the column stays scannable at a glance.
 */
export function TodayTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[13px] text-muted">
        No classes today 🎉
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {items.map((t, i) => {
        const tokens = getAccentTokens(colorFamilyForSubject(t.subjectName));
        return (
          <div
            key={`${t.time}-${i}`}
            className="flex gap-3.5 px-1 py-3 border-b border-line last:border-b-0"
          >
            <div className="w-[52px] shrink-0">
              <div className="font-extrabold text-[14px] text-ink leading-none">
                {t.time}
              </div>
              <div className="text-[11px] text-muted mt-1">{t.duration}</div>
            </div>
            <div
              className="w-1 rounded-full shrink-0"
              style={{ background: tokens.arrow }}
            />
            <div className="min-w-0">
              <div className="font-bold text-[14px] text-ink truncate">
                {t.title}
              </div>
              <div className="text-[12px] text-muted truncate mt-0.5">
                {t.sub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
