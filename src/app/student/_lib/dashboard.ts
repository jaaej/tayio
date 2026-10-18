import "server-only";
import { formatMoney, melbourneDayKey } from "@/lib/format";
import { termWeekLabel } from "@/lib/curriculum";
import { getLatestQuizAttempts } from "@/lib/quiz-scores";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { getStudentCurriculum } from "@/app/student/subjects/[id]/_queries";
import {
  getMyBests,
  getStudentYearLevel,
  getYearBlitzRank,
} from "@/app/student/math-game/_queries";
import { formatTime, yearLevelLabel } from "@/lib/format";
import { isHandedIn } from "@/lib/homework-rules";
import { buildTimetableChips } from "@/app/_lib/timetable-chips";
import { isAttendingLesson } from "@/app/student/_components/timetable-helpers";
import {
  getOutstandingBalanceForStudent,
  getStudentHomework,
  getStudentSubjects,
} from "./queries";
import {
  buildStudentTodo,
  buildWeekDays,
  featuredSubjectId,
  nextLessonBySubject,
  nextLessonLabel,
  shortSubject,
  type DashHomework,
  type DashLesson,
  type DashWeekItem,
  type StudentTodo,
  type WeekDay,
} from "./dashboard-rules";

export type DashboardSubject = {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  tutorName: string;
  thisWeek: string | null;
  nextLesson: string;
  featured: boolean;
  /** This week's checklist (video, booklet, homework, quiz): done / total. */
  weekDone: number;
  weekTotal: number;
};

export type StudentDashboard = {
  todayIso: string;
  termLabel: string | null;
  subjects: DashboardSubject[];
  todo: StudentTodo[];
  week: WeekDay[];
  /** The header's main action: the most urgent open homework, if any. */
  nextHomework: { href: string; label: string } | null;
  /** Hero status line, e.g. "English is on now · 2 things due this week". */
  status: string | null;
  blitz: { yearRank: number | null; yearLabel: string | null; best: string | null };
};

/** Lessons far enough ahead to find every subject's next one. */
const LOOKAHEAD_DAYS = 28;

/**
 * This week's curriculum week per subject, using the student's own access
 * rules (entry term, grants, weekly release). Holidays have no current week.
 */
type WeekProgress = { weekDone: number; weekTotal: number };

async function currentWeeks(
  studentId: string,
  subjects: Array<{ subjectId: string; subjectName: string; subjectColor: string | null }>,
  todayIso: string,
): Promise<Array<DashWeekItem & WeekProgress & { bookletOpened: boolean; hasBooklet: boolean; homeworkDone: number; homeworkTotal: number }>> {
  const curricula = await Promise.all(
    subjects.map((subject) =>
      getStudentCurriculum(studentId, subject.subjectId, undefined, undefined).then(
        (data) => ({ subject, data }),
      ),
    ),
  );
  const items: Array<DashWeekItem & { bookletOpened: boolean; hasBooklet: boolean; homeworkDone: number; homeworkTotal: number }> = [];
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
      subjectColor: subject.subjectColor,
      subjectWeekId: week.subjectWeekId,
      weekNumber: week.weekNumber,
      weekTitle: week.title,
      quiz: week.quiz,
      quizDone: false,
      hasVideo: Boolean(week.videoUrl),
      videoWatched: Boolean(week.videoWatchedAt),
      hasBooklet: Boolean(week.bookletUrl),
      bookletOpened: Boolean(week.bookletOpenedAt),
      homeworkTotal: week.homework.length,
      homeworkDone: week.homework.filter((h) => isHandedIn(h.status)).length,
    });
  }
  const attempts = await getLatestQuizAttempts(
    studentId,
    items.map((item) => item.subjectId),
  );
  const attempted = new Set(attempts.map((a) => a.quizId));
  return items.map((item) => {
    const quizDone = item.quiz ? attempted.has(item.quiz.id) : false;
    const parts: Array<[boolean, boolean]> = [
      [item.hasVideo, item.videoWatched],
      [item.hasBooklet, item.bookletOpened],
      [Boolean(item.quiz), quizDone],
    ];
    const present = parts.filter(([has]) => has);
    return {
      ...item,
      quizDone,
      weekTotal: present.length + item.homeworkTotal,
      weekDone: present.filter(([, done]) => done).length + item.homeworkDone,
    };
  });
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

  const [enrolled, homeworkRows, lessonChips, termLabel, outstanding, yearLevel, bests] = await Promise.all([
    getStudentSubjects(studentId),
    getStudentHomework(studentId),
    // The timetable's own lessons, so a moved or cancelled lesson is never
    // "next" and a make-up is.
    buildTimetableChips(studentId, from, to),
    termWeekLabel(todayIso),
    opts.isUnrestricted ? getOutstandingBalanceForStudent(studentId) : Promise.resolve(null),
    getStudentYearLevel(studentId),
    getMyBests(studentId),
  ]);
  const yearRank = yearLevel ? await getYearBlitzRank(studentId, yearLevel) : null;
  const bestEntry = Object.entries(bests).reduce<[string, number] | null>(
    (top, [level, score]) => (score > 0 && (!top || score > top[1]) ? [level, score] : top),
    null,
  );

  // One card per subject even if the student is in two classes of it.
  const subjects = [...new Map(enrolled.map((s) => [s.subjectId, s])).values()];
  const weekItems = await currentWeeks(studentId, subjects, todayIso);
  const weekBySubject = new Map(weekItems.map((w) => [w.subjectId, w]));

  const lessons: DashLesson[] = lessonChips.filter(isAttendingLesson).map((l) => ({
    id: l.id,
    date: l.date,
    startTime: l.startTime,
    endTime: l.endTime,
    status: l.status,
    subjectId: l.subjectId,
    subjectName: l.subjectName,
    subjectColor: l.subjectColor,
  }));
  const homework: DashHomework[] = homeworkRows.map((h) => ({
    homeworkId: h.homeworkId,
    title: h.title,
    dueDay: melbourneDayKey(h.dueDate),
    status: h.status,
    score: h.score,
    markedAt: h.markedAt,
    subjectName: h.subjectName,
    subjectColor: h.subjectColor,
  }));

  const next = nextLessonBySubject(lessons, now);
  const featured = featuredSubjectId(next);
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
      subjectColor: s.subjectColor,
      tutorName: `${s.tutorFirstName} ${s.tutorLastName}`.trim(),
      thisWeek: weekBySubject.get(s.subjectId)?.weekTitle ?? null,
      nextLesson: nextLessonLabel(next.get(s.subjectId), todayIso),
      featured: s.subjectId === featured,
      weekDone: weekBySubject.get(s.subjectId)?.weekDone ?? 0,
      weekTotal: weekBySubject.get(s.subjectId)?.weekTotal ?? 0,
    })),
    todo,
    week: buildWeekDays({ weekStartIso, todayIso, lessons, homework, now }),
    nextHomework: nextHomework
      ? { href: nextHomework.href, label: `${nextHomework.action} homework` }
      : null,
    status: statusLine(next, homework, weekStartIso, todayIso),
    blitz: {
      yearRank: yearRank?.rank ?? null,
      yearLabel: yearLevel ? yearLevelLabel(yearLevel) : null,
      best: bestEntry
        ? `Best on ${bestEntry[0].charAt(0).toUpperCase()}${bestEntry[0].slice(1)}: ${bestEntry[1]}`
        : null,
    },
  };
}

function statusLine(
  next: ReturnType<typeof nextLessonBySubject>,
  homework: DashHomework[],
  weekStartIso: string,
  todayIso: string,
): string | null {
  const parts: string[] = [];
  const live = [...next.values()].find((lesson) => lesson.live);
  if (live) {
    parts.push(`${shortSubject(live.subjectName)} is on now`);
  } else {
    const today = [...next.values()].find((lesson) => lesson.date === todayIso);
    if (today) parts.push(`${shortSubject(today.subjectName)} at ${formatTime(today.startTime)}`);
  }
  const weekEnd = addIsoDays(weekStartIso, 7);
  const due = homework.filter(
    (hw) =>
      !isHandedIn(hw.status) &&
      hw.dueDay >= todayIso &&
      hw.dueDay < weekEnd,
  ).length;
  if (due > 0) parts.push(`${due} ${due === 1 ? "thing" : "things"} due this week`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
