import {
  TrendingUp,
  Medal,
  AlertTriangle,
  ClipboardCheck,
  UserX,
} from "lucide-react";
import { Card, StatTile, PageHeader, Empty } from "@/components/parent/ui";
import { SubjectPill } from "@/components/data/subject-pill";
import { requireRole } from "@/lib/auth";
import { MASTERY_LABEL } from "@/lib/status";
import {
  getChildProgressBySubject,
  getDashboardData,
  resolveSelectedChild,
} from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { StatusPill } from "../_components/status-pill";
import { Table, Th, Td, Tr } from "../_components/table";

type Mastery = "not_started" | "needs_work" | "improving" | "strong";

const MASTERY_PILL: Record<Mastery, string> = {
  strong: "bg-emerald-100 text-emerald-900",
  improving: "bg-brand-100 text-brand-700",
  needs_work: "bg-amber-100 text-amber-900",
  not_started: "bg-surface-2 text-ink-soft",
};

// Coarse 4-step bar widths for a visual sense of level. These are NOT measured
// percentages (there is no per-topic score), so no numeric % is ever shown -
// the category pill is the honest label.
const MASTERY_STEP: Record<Mastery, number> = {
  strong: 100,
  improving: 66,
  needs_work: 33,
  not_started: 8,
};

const MASTERY_BAR: Record<Mastery, string> = {
  strong: "bg-emerald-500",
  improving: "bg-brand-500",
  needs_work: "bg-amber-500",
  not_started: "bg-line-strong",
};

type SearchParams = Promise<{ child?: string }>;

export default async function ParentProgressPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  if (!selected) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Progress"
          sub="How your child is tracking across subjects and topics."
        />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const [subjects, dashboard] = await Promise.all([
    getChildProgressBySubject(selected.id),
    getDashboardData(selected.id),
  ]);

  const topics = subjects.flatMap((s) =>
    s.topics.map((t) => ({
      ...t,
      subjectName: s.subjectName,
    })),
  );
  const trackedSubjects = subjects.filter((s) => s.topics.length > 0);

  const overall =
    trackedSubjects.length > 0
      ? Math.round(
          trackedSubjects.reduce((acc, s) => acc + s.masteryPercent, 0) /
            trackedSubjects.length,
        )
      : null;

  const strongCount = topics.filter((t) => t.mastery === "strong").length;
  const needsWorkCount = topics.filter(
    (t) => t.mastery === "needs_work" || t.mastery === "not_started",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${selected.firstName}'s progress`}
        sub="Topic-by-topic mastery across every subject."
      />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent/progress"
          />
        </div>
      )}

      <section
        className="grid grid-cols-2 lg:grid-cols-5 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Overall mastery"
          value={overall !== null ? `${overall}%` : "-"}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="grape"
          accent
          delta={`${trackedSubjects.length} subject${trackedSubjects.length === 1 ? "" : "s"} tracked`}
          deltaTone={overall !== null && overall >= 75 ? "up" : "flat"}
        />
        <StatTile
          label="Topics mastered"
          value={strongCount.toString()}
          icon={<Medal className="h-5 w-5" />}
          tone="sun"
          accent
          delta="Rated strong"
          deltaTone={strongCount > 0 ? "up" : "flat"}
        />
        <StatTile
          label="Needs work"
          value={needsWorkCount.toString()}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={needsWorkCount === 0 ? "good" : "coral"}
          accent
          delta="Weak or untouched"
          deltaTone={needsWorkCount === 0 ? "up" : "down"}
        />
        <StatTile
          label="Attendance rate"
          value={
            dashboard.attendanceRate !== null
              ? `${dashboard.attendanceRate}%`
              : "-"
          }
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="mint"
          accent
          delta="All logged lessons"
          deltaTone={
            dashboard.attendanceRate === null
              ? "flat"
              : dashboard.attendanceRate >= 90
                ? "up"
                : dashboard.attendanceRate < 75
                  ? "down"
                  : "flat"
          }
        />
        <div className="max-lg:col-span-2">
          <StatTile
            label="Absences"
            value={dashboard.absenceCount.toString()}
            icon={<UserX className="h-5 w-5" />}
            tone={dashboard.absenceCount === 0 ? "good" : "coral"}
            accent
            delta="Marked absent"
            deltaTone={dashboard.absenceCount === 0 ? "up" : "down"}
          />
        </div>
      </section>

      <div className="rise" style={{ animationDelay: "80ms" }}>
        {topics.length === 0 ? (
          <Card>
            <Empty>
              {selected.firstName} isn't enrolled in any subjects with tracked
              topics yet. Once classes start, the tutor will begin tracking
              topics here.
            </Empty>
          </Card>
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Topic</Th>
                  <Th>Subject</Th>
                  <Th className="w-[34%]">Mastery</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {topics.map((t, i) => {
                  const m = t.mastery as Mastery;
                  return (
                    <Tr key={`${t.subjectName}-${t.topic}-${i}`}>
                      <Td className="font-bold text-ink">{t.topic}</Td>
                      <Td>
                        <SubjectPill name={t.subjectName} />
                      </Td>
                      <Td>
                        <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
                          <span
                            className={`block h-full rounded-full ${MASTERY_BAR[m]}`}
                            style={{ width: `${MASTERY_STEP[m]}%` }}
                          />
                        </div>
                      </Td>
                      <Td>
                        <StatusPill
                          label={MASTERY_LABEL[m] ?? m}
                          className={MASTERY_PILL[m]}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
