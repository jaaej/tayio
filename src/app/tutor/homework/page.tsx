import Link from "next/link";
import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { FilterToolbar, type FilterPill } from "@/components/ui/filter-toolbar";
import { formatDueDate } from "@/lib/format";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { getTutorMarkingQueue, requireTutor } from "../_data";

/** Pill value for submissions whose class has no subject attached. */
const NO_SUBJECT = "none";

export default async function TutorHomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; subject?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();

  const tutor = await requireTutor();
  const rows = await getTutorMarkingQueue(tutor.id);

  // Subjects come from the whole queue, not the filtered slice: a pill list
  // that shrinks with the filter can strand the user on an empty view.
  const subjects: FilterPill[] = [];
  for (const r of rows) {
    const value = r.subjectId ?? NO_SUBJECT;
    if (!subjects.some((s) => s.value === value)) {
      subjects.push({ value, label: r.subjectName ?? "Other" });
    }
  }

  const activeSubject = subjects.some((s) => s.value === sp.subject)
    ? (sp.subject as string)
    : "";

  // Rows arrive subject-ordered, then by student name - keep that order.
  const queue = rows.filter((r) => {
    if (activeSubject && (r.subjectId ?? NO_SUBJECT) !== activeSubject) {
      return false;
    }
    if (!query) return true;
    return (
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(query) ||
      r.homeworkTitle.toLowerCase().includes(query)
    );
  });

  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        <PageHead eyebrow="Marking" title="Marking queue" />
        <Card>
          <CardBody>
            <div className="px-2 py-6 text-sm text-muted text-center">
              All caught up - nothing waiting to mark. Assign new homework from a
              class&apos;s{" "}
              <Link
                href="/tutor/classes"
                className="text-brand-600 font-bold hover:text-brand-700"
              >
                curriculum
              </Link>
              .
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const pills: FilterPill[] = [
    { value: "", label: "All subjects" },
    ...subjects,
  ];

  return (
    <div className="space-y-5">
      <PageHead eyebrow="Marking" title="Marking queue" />

      <Card className="overflow-hidden">
        {/* Search and subject live at the top of the table's own card: they are
            the table's controls, not a separate surface to look in. */}
        <FilterToolbar
          searchPlaceholder="Search student or homework"
          pillParam="subject"
          pills={pills}
        />
        {/* The table always renders under the toolbar - hiding it on an empty
            result would strip away the only controls that can undo the
            filter. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-2">
                <Th>Student</Th>
                <Th>Homework</Th>
                <Th>Due</Th>
                <Th>Subject</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="py-6 text-center text-sm text-ink-soft">
                      No submissions match these filters.
                    </p>
                  </td>
                </tr>
              ) : (
                queue.map((r) => (
                  <tr
                    key={`${r.homeworkId}-${r.studentId}`}
                    className="border-b border-line transition-colors hover:bg-surface-2"
                  >
                    <Td>
                      <span className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-[12px] font-bold text-white">
                          {initials(r)}
                        </span>
                        <Link
                          href={`/tutor/homework/${r.homeworkId}`}
                          className="inline-flex min-h-9 items-center rounded-[6px] font-bold text-ink transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                        >
                          {r.firstName} {r.lastName}
                        </Link>
                      </span>
                    </Td>
                    <Td>
                      {/* Bounded so a long title truncates instead of pushing
                          due date and status off the far edge; the full value
                          stays reachable as a tooltip. */}
                      <span
                        className="block max-w-[260px] truncate"
                        title={r.homeworkTitle}
                      >
                        {r.homeworkTitle}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted tabular-nums">
                      {formatDueDate(r.dueDate)}
                    </Td>
                    <Td>
                      <SubjectPill name={r.subjectName ?? "Other"} />
                    </Td>
                    <Td>
                      <Pill tone={r.status === "late" ? "warn" : "info"}>
                        {r.status === "late" ? "Late" : "Submitted"}
                      </Pill>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/tutor/homework/${r.homeworkId}`}
                        aria-label={`Mark ${r.homeworkTitle} for ${r.firstName} ${r.lastName}`}
                        className="inline-flex min-h-9 items-center rounded-[8px] px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-600 transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                      >
                        Mark →
                      </Link>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3 align-middle text-[13px] text-ink ${className}`}>
      {children}
    </td>
  );
}

function SubjectPill({ name }: { name: string }) {
  const tokens = getAccentTokens(colorFamilyForSubject(name));
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-bold leading-none whitespace-nowrap"
      style={{ background: tokens.pillBg, color: tokens.pillText }}
    >
      {name}
    </span>
  );
}

function initials(s: { firstName: string; lastName: string }): string {
  return `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase();
}
