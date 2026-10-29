import "server-only";

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
import { getWatchSignals } from "@/app/admin/_lib/watch-signals";
import type { WatchSignals } from "@/app/admin/_lib/watch-rules";
import type { DirectoryListItem, RowFlag } from "./directory-list";

function rowFlag(
  u: DirectoryUser,
  today: string,
  signals: WatchSignals,
): RowFlag | null {
  // The same signals as the dashboard's "Students to watch".
  const absent = signals.absences.get(u.id);
  if (absent) return { label: `${absent.absent} absent`, tone: "bad" };
  const overdue = signals.overdueHomework.get(u.id);
  if (overdue) return { label: `${overdue} HW overdue`, tone: "warn" };
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
