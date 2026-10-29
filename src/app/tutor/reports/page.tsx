import { Empty, GlassPanel, PageHeader } from "@/components/admin/ui";
import { requireTutor } from "@/app/tutor/_data";
import { formatDateShort } from "@/lib/format";
import { getReportWritingTerm, getTutorReportClasses } from "@/lib/term-report-entries";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { ReportList } from "./_components/report-list";

export const dynamic = "force-dynamic";

/**
 * Term reports for a tutor: from three weeks before a term ends to four
 * weeks after, each class they taught with its students, where they write
 * each student's summary and ratings for that subject.
 */
export default async function TutorReportsPage() {
  const tutor = await requireTutor();
  const term = await getReportWritingTerm();
  if (!term) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Term reports" />
        <GlassPanel>
          <Empty>Term reports open three weeks before a term ends.</Empty>
        </GlassPanel>
      </div>
    );
  }
  const classes = await getTutorReportClasses(tutor.id, term);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Term reports" sub={`${term.year} Term ${term.termNumber}`} />
      {classes.length === 0 ? (
        <GlassPanel>
          <Empty>You had no classes with students this term.</Empty>
        </GlassPanel>
      ) : (
        <ReportList
          termId={term.id}
          classes={classes.map((c) => ({
            classId: c.classId,
            label: c.label,
            subjectId: c.subjectId,
            students: c.students.map((s) => ({
              id: s.id,
              name: s.name,
              written: s.written,
              // Formatted here: dates rendered in the browser differ in Safari.
              sentLabel: s.sentAt ? `Sent ${formatDateShort(melbourneDate(s.sentAt))}` : null,
            })),
          }))}
        />
      )}
    </div>
  );
}
