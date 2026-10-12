"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Empty,
  ListPane,
  ListPaneGroup,
  ListPaneRow,
  ListPaneSearch,
  ListPaneTitle,
  SegmentedLinks,
  SubjectDot,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import {
  distinctStudentCount,
  filterGroups,
  withListQuery,
  type FlagTone,
  type StudentListGroup,
  type StudentListRow,
} from "../_lib/student-list";
import { StudentAvatar } from "./student-avatar";

const FLAG: Record<FlagTone, string> = {
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
  info: "bg-info-bg text-info",
  good: "bg-good-bg text-good",
};

/**
 * The left pane of the tutor students split view, grouped by class (the way
 * a tutor thinks about their roster). It lives in the students layout, so it
 * stays mounted while the tutor moves between profiles; search and the year
 * filter live in the URL and every row link carries them along.
 */
export function StudentListPane({
  groups,
  years,
}: {
  groups: StudentListGroup[];
  years: Array<{ key: string; label: string }>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scroller = useRef<HTMLDivElement>(null);

  const selectedId = /^\/tutor\/students\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const query = searchParams.get("q") ?? "";
  const yearParam = searchParams.get("year");
  const year = years.some((y) => y.key === yearParam) ? yearParam : null;

  const listed = useMemo(() => filterGroups(groups, query, year), [groups, query, year]);
  const hasStudents = groups.some((g) => g.students.length > 0);

  // A deep link to a profile lands with the list scrolled to the top; bring
  // the selected row into view once, inside the list's own scroller.
  useEffect(() => {
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !row) return;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2 + row.offsetHeight / 2;
    }
    // Mount only: later selections are clicks on rows already in view.
  }, []);

  // Year tabs keep the open profile and the search.
  const yearHref = (next: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("year", next);
    else params.delete("year");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <ListPane
      labelledBy="students-list-heading"
      hiddenBelowXl={Boolean(selectedId)}
      scrollRef={scroller}
      header={
        <>
          <ListPaneTitle id="students-list-heading" count={distinctStudentCount(listed)}>
            Students
          </ListPaneTitle>
          {hasStudents && (
            <ListPaneSearch label="Search students" placeholder="Search name or email" />
          )}
          {years.length > 1 && (
            <SegmentedLinks
              label="Filter by year"
              stretch
              items={[
                { label: "All", href: yearHref(null), active: year === null },
                ...years.map((y) => ({
                  label: y.label,
                  href: yearHref(y.key),
                  active: year === y.key,
                })),
              ]}
            />
          )}
        </>
      }
    >
      {!hasStudents ? (
        <Empty>
          Students appear here once you are assigned a class with enrolled students.
        </Empty>
      ) : listed.length === 0 ? (
        <Empty>No students match this search.</Empty>
      ) : (
        listed.map((group) => (
          <ListPaneGroup
            key={group.classId}
            id={`students-group-${group.classId}`}
            label={
              <span className="flex items-center gap-1.5">
                <SubjectDot subject={group.subjectName} className="h-[7px] w-[7px]" />
                {group.label}
              </span>
            }
          >
            {group.students.map((student) => (
              <li key={student.id}>
                <StudentRow
                  student={student}
                  href={withListQuery(`/tutor/students/${student.id}`, searchParams)}
                  selected={student.id === selectedId}
                />
              </li>
            ))}
          </ListPaneGroup>
        ))
      )}
    </ListPane>
  );
}

function StudentRow({
  student,
  href,
  selected,
}: {
  student: StudentListRow;
  href: string;
  selected: boolean;
}) {
  const name = `${student.firstName} ${student.lastName}`.trim();
  return (
    <ListPaneRow href={href} selected={selected}>
      <StudentAvatar name={name} avatarKey={student.avatarKey} size={34} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-bold">{name}</span>
        <span className="truncate text-[12px] text-muted">{student.sub}</span>
      </span>
      {student.flag && (
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-[7px] text-[10px] font-extrabold uppercase",
            FLAG[student.flag.tone],
          )}
        >
          {student.flag.label}
        </span>
      )}
    </ListPaneRow>
  );
}
