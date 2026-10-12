import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  directoryStatus,
  getUserDirectory,
  type DirectoryUser,
} from "@/app/admin/_lib/queries";
import { coarseRole } from "@/lib/roles";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import {
  accountScheduleStatusLabel,
  freeTrialDirectoryState,
} from "@/lib/account-schedule-status";
import { getSubjectSearchAliases } from "@/lib/subject-search-aliases";
import type { SubjectAlias } from "@/lib/directory-search";
import type { DirectoryListItem, RowFlag } from "./directory-list";

/**
 * Students showing the same warning signs as the dashboard's "Students to
 * watch": 2+ absences across their last four marked lessons, or 2+ homework
 * tasks past due and not handed in. Two aggregate queries for the whole
 * centre, so the list can flag rows without a query per person.
 */
async function getWatchSignals(): Promise<{
  absences: Map<string, number>;
  overdueHomework: Map<string, number>;
}> {
  const [absenceRows, homeworkRows] = await Promise.all([
    db.execute<{ student_id: string; absent: number }>(sql`
      select student_id,
             count(*) filter (where status = 'absent')::int as absent
      from (
        select a.student_id, a.status,
               row_number() over (partition by a.student_id order by l.date desc, l.start_time desc) as rn
        from attendance a
        join lessons l on l.id = a.lesson_id
      ) recent
      where rn <= 4
      group by student_id
      having count(*) filter (where status = 'absent') >= 2
    `),
    db.execute<{ student_id: string; pending: number }>(sql`
      select ha.student_id, count(*)::int as pending
      from homework_assignments ha
      join homework h on h.id = ha.homework_id
      where ha.status in ('not_started','viewed','late','resubmission_requested')
        and h.due_date < now()
      group by ha.student_id
      having count(*) >= 2
    `),
  ]);
  return {
    absences: new Map(absenceRows.map((r) => [r.student_id, r.absent])),
    overdueHomework: new Map(homeworkRows.map((r) => [r.student_id, r.pending])),
  };
}

function rowFlag(
  u: DirectoryUser,
  today: string,
  signals: Awaited<ReturnType<typeof getWatchSignals>>,
): RowFlag | null {
  const absent = signals.absences.get(u.id);
  if (absent) return { label: `${absent} absent`, tone: "bad" };
  if (signals.overdueHomework.has(u.id)) return { label: "HW due", tone: "warn" };
  if (u.schedulePeriod) {
    const label = accountScheduleStatusLabel(u.schedulePeriod, today);
    // Only states that are true today; future breaks live on the profile.
    if (label === "On break" || label === "On leave") return { label, tone: "info" };
  }
  if (freeTrialDirectoryState(u.trialPeriod, today) === "current") {
    return { label: "Trial", tone: "good" };
  }
  return null;
}

function subLine(u: DirectoryUser): string {
  const role = coarseRole(u.role);
  if (role === "parent") {
    return u.linkedFamily.length > 0
      ? `Parent of ${u.linkedFamily.map((p) => p.name).join(", ")}`
      : u.email;
  }
  if (role === "student" || role === "tutor") {
    const subjects = Array.from(
      new Map(
        u.classInfo.map((c) => [c.subjectName.trim().toLowerCase(), c.subjectName]),
      ).values(),
    );
    if (subjects.length > 0) return subjects.join(" · ");
  }
  return u.email;
}

export type DirectoryPaneData = {
  items: DirectoryListItem[];
  schools: string[];
  aliases: SubjectAlias[];
};

/** Everything the list pane needs, shaped once on the server. */
export async function getDirectoryPaneData(): Promise<DirectoryPaneData> {
  const [directory, aliasRows, signals] = await Promise.all([
    getUserDirectory(),
    getSubjectSearchAliases(),
    getWatchSignals(),
  ]);
  const today = melbourneDate(new Date());

  const items: DirectoryListItem[] = directory.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: coarseRole(u.role),
    status: directoryStatus(u),
    school: u.school,
    yearLevel: u.yearLevel,
    sub: subLine(u),
    note: u.adminNote?.trim() || null,
    flag: coarseRole(u.role) === "student" || coarseRole(u.role) === "tutor"
      ? rowFlag(u, today, signals)
      : null,
    classInfo: u.classInfo.map((c) => ({
      name: c.name,
      subjectName: c.subjectName,
      subjectId: c.subjectId,
    })),
  }));

  // Options come from the whole directory, never the filtered slice, so the
  // school currently in use never disappears from its own dropdown.
  const schools = Array.from(
    new Set(directory.map((u) => u.school).filter((s): s is string => !!s)),
  ).sort((a, b) => a.localeCompare(b));

  const aliases = aliasRows.flatMap((entry) =>
    entry.alias ? [{ subjectId: entry.subjectId, alias: entry.alias }] : [],
  );

  return { items, schools, aliases };
}
