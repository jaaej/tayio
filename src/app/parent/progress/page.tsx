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
import { MASTERY_LEVEL_LABEL, type MasteryLevel } from "@/lib/topic-mastery";
import {
  getChildMastery,
  getDashboardData,
  resolveSelectedChild,
} from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { StatusPill } from "../_components/status-pill";
import { Table, Th, Td, Tr } from "../_components/table";

const LEVEL_PILL: Record<MasteryLevel, string> = {
  strong: "bg-emerald-100 text-emerald-900",
  improving: "bg-brand-100 text-brand-700",
  needs_work: "bg-amber-100 text-amber-900",
};

const LEVEL_BAR: Record<MasteryLevel, string> = {
  strong: "bg-emerald-500",
  improving: "bg-brand-500",
  needs_work: "bg-amber-500",
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
        />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const [mastery, dashboard] = await Promise.all([
    getChildMastery(selected.id),
    getDashboardData(selected.id),
  ]);

  const topics = mastery.subjects.flatMap((s) =>
    s.topics.map((t) => ({
      ...t,
      subjectName: s.subjectName,
      subjectColor: s.subjectColor,
    })),
  );
  const trackedSubjects = mastery.subjects.filter((s) => s.percent !== null);
  const overall = mastery.overall;

  const strongCount = topics.filter((t) => t.level === "strong").length;
  const needsWorkCount = topics.filter((t) => t.level === "needs_work").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${selected.firstName}'s progress`}
        sub="Topic-by-topic mastery across every subject."
      />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            students={children}
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
          delta="Below 60%"
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
              {selected.firstName}&apos;s subjects have no curriculum topics yet.
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
                {topics.map((t) => {
                  return (
                    <Tr key={t.topicId}>
                      <Td className="font-bold text-ink">{t.topic}</Td>
                      <Td>
                        <SubjectPill name={t.subjectName} color={t.subjectColor} />
                      </Td>
                      <Td>
                        <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
                          <span
                            className={`block h-full rounded-full ${t.level ? LEVEL_BAR[t.level] : ""}`}
                            style={{ width: `${t.percent ?? 0}%` }}
                          />
                        </div>
                      </Td>
                      <Td>
                        <StatusPill
                          label={t.level ? `${t.percent}% · ${MASTERY_LEVEL_LABEL[t.level]}` : "No marks yet"}
                          className={t.level ? LEVEL_PILL[t.level] : "bg-surface-2 text-ink-soft"}
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
