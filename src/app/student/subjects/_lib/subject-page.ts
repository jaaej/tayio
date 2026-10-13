import "server-only";
import { currentWeekNumber } from "@/lib/curriculum";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { getStudentSubjects } from "@/app/student/_lib/queries";
import {
  getStudentCurriculum,
  type StudentCurriculumData,
  type StudentCurriculumWeek,
} from "../[id]/_queries";
import {
  checklistProgress,
  unlockLabel,
  weekChecklist,
  weekComplete,
  type ChecklistTask,
} from "./week-checklist";

export type SubjectTab = {
  subjectId: string;
  subjectName: string;
  /** Open homework waiting in this subject. */
  dueCount: number;
};

export type SubjectRailWeek = {
  id: string;
  weekNumber: number;
  title: string;
  topicId: string | null;
  topicName: string | null;
  locked: boolean;
  lockedHint: string | undefined;
  complete: boolean;
  isCurrent: boolean;
};

export type StudentSubjectPage =
  | { kind: "not-enrolled" }
  | { kind: "no-curriculum"; tabs: SubjectTab[]; subjectName: string }
  | {
      kind: "ready";
      tabs: SubjectTab[];
      data: StudentCurriculumData;
      railWeeks: SubjectRailWeek[];
      currentWeekId: string | null;
      /** The week on screen; null when every week of the term is still locked. */
      week: StudentCurriculumWeek | null;
      firstUnlock: string | null;
      tasks: ChecklistTask[];
      progress: { done: number; total: number };
      videoSrc: string | null;
      tutorFirstName: string | null;
    };

/** One tab per subject, even when the student is in two classes of it. */
export async function getSubjectTabs(studentId: string): Promise<SubjectTab[]> {
  const enrolled = await getStudentSubjects(studentId);
  const tabs = new Map<string, SubjectTab>();
  for (const row of enrolled) {
    const tab = tabs.get(row.subjectId);
    if (tab) tab.dueCount += row.dueHomeworkCount;
    else
      tabs.set(row.subjectId, {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        dueCount: row.dueHomeworkCount,
      });
  }
  return [...tabs.values()];
}

/**
 * Everything the merged subject page shows: the subject tabs, the weeks
 * rail, the selected week (the requested one, else this teaching week, else
 * the first open week) and its checklist.
 */
export async function getStudentSubjectPage(
  studentId: string,
  subjectId: string,
  termId: string | undefined,
  weekId: string | undefined,
  now: Date = new Date(),
): Promise<StudentSubjectPage> {
  const [tabs, data] = await Promise.all([
    getSubjectTabs(studentId),
    getStudentCurriculum(studentId, subjectId, termId, weekId),
  ]);
  const tab = tabs.find((t) => t.subjectId === subjectId);

  // Tabs list only active enrolments, so a withdrawn student gets a 404.
  if (!tab) return { kind: "not-enrolled" };
  if (!data) return { kind: "no-curriculum", tabs, subjectName: tab.subjectName };

  const tutorFirstName = data.tutorName?.split(/\s+/)[0] ?? null;
  const maxWeek = data.weeks.reduce((acc, w) => Math.max(acc, w.weekNumber), 0);
  const currentNumber = currentWeekNumber(
    { startDate: data.currentTerm.startDate, endDate: data.currentTerm.endDate },
    maxWeek,
    now,
  );
  const currentWeekId =
    data.weeks.find((w) => w.weekNumber === currentNumber)?.subjectWeekId ?? null;

  const week =
    data.weeks.find((w) => w.subjectWeekId === data.selectedWeekId && !w.locked) ??
    data.weeks.find((w) => w.subjectWeekId === currentWeekId && !w.locked) ??
    data.weeks.find((w) => !w.locked) ??
    null;

  const railWeeks: SubjectRailWeek[] = data.weeks.map((w) => ({
    id: w.subjectWeekId,
    weekNumber: w.weekNumber,
    title: w.title,
    topicId: w.topicId,
    topicName: w.topicName,
    locked: w.locked,
    lockedHint: w.locked ? unlockLabel(w.unlocksOn) : undefined,
    complete: !w.locked && weekComplete(weekChecklist(w, { now, tutorFirstName })),
    isCurrent: w.subjectWeekId === currentWeekId,
  }));

  const tasks = week ? weekChecklist(week, { now, tutorFirstName }) : [];
  const firstLocked = data.weeks.find((w) => w.locked);

  return {
    kind: "ready",
    tabs,
    data,
    railWeeks,
    currentWeekId,
    week,
    firstUnlock: firstLocked ? unlockLabel(firstLocked.unlocksOn) : null,
    tasks,
    progress: checklistProgress(tasks),
    videoSrc: week ? await signCurriculumUrl(week.videoUrl) : null,
    tutorFirstName,
  };
}
