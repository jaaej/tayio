import Link from "next/link";
import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { FilterToolbar, type FilterPill } from "@/components/ui/filter-toolbar";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { getTutorStudentsByClass, requireTutor } from "../_data";

type RosterEntry = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  yearLevel: string | null;
  classes: Array<{ id: string; name: string; subjectName: string }>;
};

export default async function TutorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();

  const tutor = await requireTutor();
  const { classes } = await getTutorStudentsByClass(tutor.id);

  const sub = "Only students enrolled in classes you teach.";

  if (classes.length === 0) {
    return (
      <div className="space-y-5">
        <PageHead eyebrow="Your roster" title="Students" sub={sub} />
        <Card>
          <CardBody>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              No classes yet
            </div>
            <p className="mt-2 text-sm text-muted">
              Students will appear here once you&apos;re assigned a class with
              enrolled students.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // One row per student, however many of the tutor's classes they sit in - the
  // roster answers "who do I teach", and the same face twice does not.
  const byStudent = new Map<string, RosterEntry>();
  for (const c of classes) {
    for (const s of c.students) {
      let entry = byStudent.get(s.id);
      if (!entry) {
        entry = { ...s, classes: [] };
        byStudent.set(s.id, entry);
      }
      entry.classes.push({
        id: c.classId,
        name: c.className,
        subjectName: c.subjectName,
      });
    }
  }

  const activeClass = classes.some((c) => c.classId === sp.class)
    ? (sp.class as string)
    : "";

  const roster = Array.from(byStudent.values())
    .filter((s) => !activeClass || s.classes.some((c) => c.id === activeClass))
    .filter(
      (s) =>
        !query ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query),
    )
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        undefined,
        { sensitivity: "base" },
      ),
    );

  const pills: FilterPill[] = [
    { value: "", label: "All classes" },
    ...classes.map((c) => ({ value: c.classId, label: c.className })),
  ];

  return (
    <div className="space-y-5">
      <PageHead eyebrow="Your roster" title="Students" sub={sub} />

      <Card className="overflow-hidden">
        {/* Search and class live at the top of the table's own card: they are
            the table's controls, not a separate surface to look in. */}
        <FilterToolbar
          searchPlaceholder="Search name or email"
          pillParam="class"
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
                <Th>Year</Th>
                <Th>Email</Th>
                <Th>Classes</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {roster.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="py-6 text-center text-sm text-ink-soft">
                      No students match these filters.
                    </p>
                  </td>
                </tr>
              ) : (
                roster.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-line transition-colors hover:bg-surface-2"
                  >
                    <Td>
                      <span className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-[12px] font-bold text-white">
                          {initials(s)}
                        </span>
                        <Link
                          href={`/tutor/students/${s.id}`}
                          className="inline-flex min-h-9 items-center rounded-[6px] font-bold text-ink transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                        >
                          {s.firstName} {s.lastName}
                        </Link>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {s.yearLevel ?? "-"}
                    </Td>
                    <Td className="text-muted">
                      {/* Bounded so a long address truncates instead of
                          pushing the class pills off the far edge; the full
                          value stays reachable as a tooltip. */}
                      <span
                        className="block max-w-[220px] truncate"
                        title={s.email}
                      >
                        {s.email}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {s.classes.map((c) => (
                          <ClassPill
                            key={c.id}
                            name={c.name}
                            subject={c.subjectName}
                          />
                        ))}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/tutor/students/${s.id}`}
                        aria-label={`Open ${s.firstName} ${s.lastName}`}
                        className="inline-flex min-h-9 items-center rounded-[8px] px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-600 transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                      >
                        Open →
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

function ClassPill({ name, subject }: { name: string; subject: string }) {
  const tokens = getAccentTokens(colorFamilyForSubject(subject));
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
