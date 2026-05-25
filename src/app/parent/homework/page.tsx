import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth";
import { getHomework, resolveSelectedChild, type HomeworkRow } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";

type SearchParams = Promise<{ child?: string }>;

const STATUS_LABEL: Record<HomeworkRow["status"], string> = {
  not_started: "Not started",
  viewed: "Opened",
  submitted: "Submitted",
  late: "Late",
  marked: "Marked",
  returned: "Returned",
  resubmission_requested: "Redo requested",
};

const STATUS_TONE: Record<HomeworkRow["status"], string> = {
  not_started: "bg-muted/10 text-ink-soft",
  viewed: "bg-brand-100 text-navy-800",
  submitted: "bg-emerald-50 text-emerald-700",
  late: "bg-rose-50 text-rose-700",
  marked: "bg-emerald-50 text-emerald-700",
  returned: "bg-emerald-50 text-emerald-700",
  resubmission_requested: "bg-amber-50 text-amber-700",
};

export default async function ParentHomeworkPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  if (!selected) {
    return (
      <div className="space-y-12">
        <Header />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const rows = await getHomework(selected.id);

  return (
    <div className="space-y-10">
      <Header subtitle={selected.firstName} />
      <ChildSwitcher
        children={children}
        selectedId={selected.id}
        basePath="/parent/homework"
      />

      {rows.length === 0 ? (
        <Card>
          <p className="text-ink-soft">
            No homework has been assigned to {selected.firstName} yet.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <Card key={r.homeworkId}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                    {r.subjectName ?? "Homework"}
                  </div>
                  <h3 className="mt-1 text-lg text-ink">{r.title}</h3>
                  <div className="mt-2 text-xs text-muted">
                    Due {formatDate(r.dueDate)}
                    {r.submittedAt
                      ? ` · Submitted ${formatDate(r.submittedAt)}`
                      : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_TONE[r.status],
                    )}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  {r.score !== null ? (
                    <span className="text-sm text-ink font-medium">
                      {r.score}
                    </span>
                  ) : null}
                </div>
              </div>
              {r.feedback ? (
                <div className="mt-4 border-t border-hairline pt-4 text-sm text-ink-soft">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-muted mr-2">
                    Tutor
                  </span>
                  {r.feedback}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="rise">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
        Homework
      </div>
      <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
        {subtitle ? (
          <>
            <span className="">{subtitle}</span>'s homework
          </>
        ) : (
          "Homework"
        )}
      </h1>
    </header>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
