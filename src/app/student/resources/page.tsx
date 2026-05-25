import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getStudentSubjects } from "../_lib/queries";

const RESOURCE_TYPES = [
  { label: "Worksheets", desc: "Practice problems by topic" },
  { label: "Notes", desc: "Concept summaries and examples" },
  { label: "Past papers", desc: "Real exam papers with solutions" },
  { label: "Videos", desc: "Concept walkthroughs from tutors" },
  { label: "Formula sheets", desc: "Quick-reference cards" },
  { label: "Writing templates", desc: "Essay structures and exemplars" },
  { label: "Exam guides", desc: "Strategy and revision plans" },
  { label: "Quizzes", desc: "Self-check questions per topic" },
];

export default async function ResourcesPage() {
  const user = await requireRole("student");
  const subjects = await getStudentSubjects(user.id);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between rise">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
            {dateLabel}
          </div>
          <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
            Resources
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Coming
          </span>
          <span className="text-ink-soft">Phase 4</span>
        </div>
      </header>

      <div
        className="grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-5 lg:gap-6 rise"
        style={{ animationDelay: "40ms" } as React.CSSProperties}
      >
        <div className="space-y-5 min-w-0">
          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
              <div className="text-xl font-medium text-ink">Library</div>
              <div className="text-sm text-ink-soft mt-1">
                Worksheets, past papers, videos and more — organised by subject,
                year level, and topic.
              </div>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3">
              {RESOURCE_TYPES.map((t) => (
                <div
                  key={t.label}
                  className="rounded-xl border border-hairline/50 bg-card p-4"
                >
                  <div className="text-sm text-ink font-medium">{t.label}</div>
                  <div className="text-xs text-muted mt-1 leading-relaxed">
                    {t.desc}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
              <div className="text-xl font-medium text-ink">In the meantime</div>
            </div>
            <div className="px-6 py-5 text-sm text-ink-soft space-y-2 leading-relaxed">
              <p>
                Your tutor can share worksheets and past papers directly through
                lesson recaps and homework attachments.
              </p>
              <p>
                The full library opens in Phase 4 with filters by subject, year
                level, topic, difficulty, and resource type.
              </p>
            </div>
          </Card>
        </div>

        <aside className="space-y-5 min-w-0">
          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
              <div className="text-xl font-medium text-ink">Your subjects</div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted mt-1">
                {subjects.length} enrolled
              </div>
            </div>
            {subjects.length === 0 ? (
              <div className="px-6 py-8 text-sm text-ink-soft">
                Once you're enrolled, your subjects will appear here.
              </div>
            ) : (
              <ul className="divide-y divide-hairline/60">
                {subjects.map((s) => (
                  <li
                    key={s.classId}
                    className="px-5 py-3 flex items-baseline justify-between gap-3"
                  >
                    <div className="text-sm text-ink truncate">
                      {s.subjectName}
                    </div>
                    {s.yearLevel && (
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted">
                        {s.yearLevel}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
