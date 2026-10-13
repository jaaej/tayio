import "server-only";
import { formatMoney, melbourneDayKey } from "@/lib/format";
import { termWeekLabel } from "@/lib/curriculum";
import { getLatestQuizAttempts } from "@/lib/quiz-scores";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { getStudentCurriculum } from "@/app/student/subjects/[id]/_queries";
import {
  getOutstandingBalanceForStudent,
  getStudentHomework,
  getStudentLessons,
  getStudentSubjects,
} from "./queries";
import {
  buildStudentTodo,
  buildWeekDays,
  featuredSubjectName,
  nextLessonBySubject,
  nextLessonLabel,
  type DashHomework,
  type DashLesson,
  type DashWeekItem,
  type StudentTodo,
  type WeekDay,
} from "./dashboard-rules";

export type DashboardSubject = {
  subjectId: string;
  subjectName: string;
  tutorName: string;
  thisWeek: string | null;
  nextLesson: string;
  featured: boolean;
};

export type StudentDashboard = {
  todayIso: string;
  termLabel: string | null;
  subjects: DashboardSubject[];
  todo: StudentTodo[];
  week: WeekDay[];
  /** The header's main action: the most urgent open homework, if any. */
  nextHomework: { href: string; label: string } | null;
};

/** Lessons far enough ahead to find every subject's next one. */
const LOOKAHEAD_DAYS = 28;

/**
 * This week's curriculum week per subject, using the student's own access
 * rules (entry term, grants, weekly release). Holidays have no current week.
 */
async function currentWeeks(
  studentId: string,
  subjects: Array<{ subjectId: string; subjectName: string }>,
  todayIso: string,
): Promise<DashWeekItem[]> {
  const curricula = await Promise.all(
    subjects.map((subject) =>
      getStudentCurriculum(studentId, subject.subjectId, undefined, undefined).then(
        (data) => ({ subject, data }),
      ),
    ),
  );
  const items: DashWeekItem[] = [];
  for (const { subject, data } of curricula) {
    if (!data) continue;
    const term = data.currentTerm;
    if (todayIso < term.startDate || todayIso > term.endDate) continue;
    const week = data.weeks
      .filter((w) => !w.locked)
      .reduce<(typeof data.weeks)[number] | null>(
        (latest, w) => (!latest || w.weekNumber > latest.weekNumber ? w : latest),
        null,
      );
    if (!week) continue;
    items.push({
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      subjectWeekId: week.subjectWeekId,
      weekNumber: week.weekNumber,
      weekTitle: week.title,
      quiz: week.quiz,
      quizDone: false,
      hasVideo: Boolean(week.videoUrl),
      videoWatched: Boolean(week.videoWatchedAt),
    });
  }
  const attempts = await getLatestQuizAttempts(
    studentId,
    items.map((item) => item.subjectId),
  );
  const attempted = new Set(attempts.map((a) => a.quizId));
  return items.map((item) => ({
    ...item,
    quizDone: item.quiz ? attempted.has(item.quiz.id) : false,
  }));
}

export async function getStudentDashboard(
  studentId: string,
  opts: { isUnrestricted: boolean; now?: Date },
): Promise<StudentDashboard> {
  const now = opts.now ?? new Date();
  const todayIso = melbourneDate(now);
  const weekStartIso = weekStartForIsoDate(todayIso);
  const from = new Date(`${weekStartIso}T00:00:00`);
  const to = new Date(`${addIsoDays(todayIso, LOOKAHEAD_DAYS)}T00:00:00`);

  const [enrolled, homeworkRows, lessonRows, termLabel, outstanding] = await Promise.all([
    getStudentSubjects(studentId),
    getStudentHomework(studentId),
    getStudentLessons(studentId, { from, to }),
    termWeekLabel(todayIso),
    opts.isUnrestricted ? getOutstandingBalanceForStudent(studentId) : Promise.resolve(null),
  ]);

  // One card per subject even if the student is in two classes of it.
  const subjects = [...new Map(enrolled.map((s) => [s.subjectId, s])).values()];
  const weekItems = await currentWeeks(studentId, subjects, todayIso);
  const weekBySubject = new Map(weekItems.map((w) => [w.subjectId, w]));

  const lessons: DashLesson[] = lessonRows.map((l) => ({
    id: l.id,
    date: l.date,
    startTime: l.startTime,
    endTime: l.endTime,
    status: l.status,
    subjectName: l.subjectName,
  }));
  const homework: DashHomework[] = homeworkRows.map((h) => ({
    homeworkId: h.homeworkId,
    title: h.title,
    dueDay: melbourneDayKey(h.dueDate),
    status: h.status,
    score: h.score,
    markedAt: h.markedAt,
    subjectName: h.subjectName,
  }));

  const next = nextLessonBySubject(lessons, now);
  const featured = featuredSubjectName(next);
  const todo = buildStudentTodo({
    homework,
    weekItems,
    outstanding,
    outstandingLabel: outstanding ? `${formatMoney(outstanding)} outstanding` : undefined,
    todayIso,
    now,
  });
  const nextHomework = todo.find(
    // The overdue summary row counts: it opens Homework to catch up.
    (row) => row.href.startsWith("/student/homework") && row.kind !== "marked",
  );

  return {
    todayIso,
    termLabel,
    subjects: subjects.map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      tutorName: `${s.tutorFirstName} ${s.tutorLastName}`.trim(),
      thisWeek: weekBySubject.get(s.subjectId)?.weekTitle ?? null,
      nextLesson: nextLessonLabel(next.get(s.subjectName), todayIso),
      featured: s.subjectName === featured,
    })),
    todo,
    week: buildWeekDays({ weekStartIso, todayIso, lessons, homework, now }),
    nextHomework: nextHomework
      ? { href: nextHomework.href, label: `${nextHomework.action} homework` }
      : null,
  };
}
