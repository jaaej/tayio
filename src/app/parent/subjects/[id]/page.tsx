import { notFound } from "next/navigation";
import { PageHeader, SegmentedLinks } from "@/components/admin/ui";
import { RecapCard } from "@/components/lessons/lesson-recap";
import { AttendancePanel } from "@/components/parent/attendance-panel";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import { CurriculumRail } from "@/components/subjects/curriculum-rail";
import { requireRole } from "@/lib/auth";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { getFamilyRecaps } from "@/lib/lesson-recap";
import { subjectTone } from "@/lib/subject-tone";
import { getStudentSubjectPage } from "@/app/student/subjects/_lib/subject-page";
import { SubjectHeader } from "@/app/student/subjects/[id]/_components/subject-header";
import {
  SubjectNotice,
  SubjectWeekBody,
} from "@/app/student/subjects/[id]/_components/week-body";
import { getAttendance, resolveSelectedChild } from "../../_data";
import { EmptyChildrenNotice } from "../../_components/empty-children";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ child?: string; term?: string; week?: string; tab?: string }>;

const TABS = [
  { key: "week", label: "Weekly work" },
  { key: "attendance", label: "Attendance" },
  { key: "feedback", label: "Tutor feedback" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/**
 * One subject of the child's, in one place: the student's own subject page
 * (hero with the child's subjects as tabs, the weeks rail and the week, read
 * only), then the class's attendance and the tutor's recaps as sections.
 */
export default async function ParentSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const [{ id: subjectId }, sp] = await Promise.all([params, searchParams]);
  const { selected } = await resolveSelectedChild(user.id, sp.child);
  if (!selected) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Subjects" />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const now = new Date();
  const page = await getStudentSubjectPage(selected.id, subjectId, sp.term, sp.week, now);
  if (page.kind === "not-enrolled") notFound();

  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "week";
  const childQs = `?child=${selected.id}`;
  const base = `/parent/subjects/${subjectId}${childQs}`;
  const subjectName = page.kind === "ready" ? page.data.subjectName : page.subjectName;
  const subjectColor = page.kind === "ready" ? page.data.subjectColor : page.subjectColor;

  const sections = (
    <SegmentedLinks
      size="md"
      label="Subject sections"
      className="self-start max-w-full overflow-x-auto"
      items={TABS.map((t) => ({
        label: t.label,
        href: t.key === "week" ? base : `${base}&tab=${t.key}`,
        active: t.key === tab,
      }))}
    />
  );

  const header =
    page.kind === "ready" ? (
      <SubjectHeader
        tabs={page.tabs}
        subjectId={subjectId}
        subjectName={subjectName}
        subjectColor={subjectColor}
        title={(tab === "week" ? page.week?.title : null) ?? subjectName}
        kicker={[
          tab === "week" && page.week ? `Week ${page.week.weekNumber}` : null,
          page.data.tutorName,
        ]
          .filter(Boolean)
          .join(" · ")}
        progress={tab === "week" ? page.progress : undefined}
        tutorId={page.data.tutorId}
        tutorFirstName={page.tutorFirstName}
        basePath="/parent/subjects"
        query={childQs}
        messageBase="/parent/messages/with"
      />
    ) : (
      <SubjectHeader
        tabs={page.tabs}
        subjectId={subjectId}
        subjectName={subjectName}
        subjectColor={subjectColor}
        title={subjectName}
        basePath="/parent/subjects"
        query={childQs}
      />
    );

  return (
    <div className="flex flex-col gap-5 text-ink">
      {header}
      {sections}
      {tab === "attendance" ? (
        <AttendancePanel
          rows={await getAttendance(selected.id, { subjectId })}
          childFirstName={selected.firstName}
          showSubject={false}
          titled={false}
        />
      ) : tab === "feedback" ? (
        <Recaps childId={selected.id} childFirstName={selected.firstName} subjectId={subjectId} />
      ) : page.kind === "no-curriculum" ? (
        <SubjectNotice>
          The tutor is preparing this term&apos;s lessons. They appear here once they&apos;re ready.
        </SubjectNotice>
      ) : (
        <CurriculumLayout
          attached
          framed
          defaultOpen
          rail={
            <CurriculumRail
              basePath={`/parent/subjects/${subjectId}`}
              extraParams={{ child: selected.id }}
              currentTermId={page.data.currentTerm.id}
              terms={page.data.termsAvailable.map((t) => ({
                id: t.id,
                label: `Term ${t.termNumber} · ${t.year}`,
              }))}
              weeks={page.railWeeks}
              selectedWeekId={page.week?.subjectWeekId ?? null}
              currentWeekIdHint={page.currentWeekId}
              showTermSelect
              accent={subjectTone(subjectName, subjectColor).flat}
            />
          }
        >
          {page.week ? (
            <SubjectWeekBody
              week={page.week}
              tasks={page.tasks}
              subjectName={subjectName}
              subjectColor={subjectColor}
              videoSrc={page.videoSrc}
              tutorFirstName={page.tutorFirstName}
              parent={{
                childId: selected.id,
                bookletSrc: await signCurriculumUrl(page.week.bookletUrl),
              }}
            />
          ) : (
            <SubjectNotice>
              {page.firstUnlock
                ? `Week 1 is locked. ${page.firstUnlock}.`
                : "This term's lessons are locked."}
            </SubjectNotice>
          )}
        </CurriculumLayout>
      )}
    </div>
  );
}

async function Recaps({
  childId,
  childFirstName,
  subjectId,
}: {
  childId: string;
  childFirstName: string;
  subjectId: string;
}) {
  const recaps = await getFamilyRecaps(childId, { subjectId });
  if (recaps.length === 0) {
    return (
      <SubjectNotice>
        No tutor feedback yet. When a tutor leaves a comment after one of {childFirstName}&apos;s
        lessons, it appears here.
      </SubjectNotice>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {recaps.map((r) => (
        <RecapCard key={r.lessonId} recap={r} href={`/parent/feedback/${r.lessonId}?child=${childId}`} />
      ))}
    </div>
  );
}
