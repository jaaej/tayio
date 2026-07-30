import "server-only";
import {
  getAllowanceBonus,
  getCancellationsUsed,
  getCancelledLessonIds,
  getCreditGrantedLessonIds,
  getReschedulesUsed,
  getTerms,
} from "@/lib/credits";
import {
  CANCEL_CAP,
  RESCHEDULE_CAP,
  meetsCancelNotice,
  meetsRescheduleNotice,
  remaining,
  resolveTerm,
  type TermRow,
} from "@/lib/reschedule-credits";
import { getStudentTimetableLessons } from "@/app/student/_lib/queries";
import type { TimetableChip } from "@/app/student/_components/interactive-timetable";

/**
 * Builds the interactive-timetable chips for one student - shared by the
 * student's own timetable and the parent's per-child timetable so both
 * portals compute identical reschedule/cancel eligibility for the same
 * lesson. Ported from the student timetable page (2026-07-30) without
 * behaviour change.
 */
export async function buildTimetableChips(
  studentId: string,
  from: Date,
  to: Date,
): Promise<TimetableChip[]> {
  const now = new Date();
  const [lessonRows, terms] = await Promise.all([
    getStudentTimetableLessons(studentId, { from, to }),
    getTerms(),
  ]);

  // Base self-serve eligibility: lesson is upcoming, in the future, and in
  // a state a cancel/reschedule makes sense for (a moved-out or
  // pending-out lesson can still be re-actioned; a make-up/pending-in chip
  // cannot). Resolve each eligible lesson's term once, then fetch that
  // term's used counts once per distinct term (not once per lesson).
  function isManageable(l: (typeof lessonRows)[number]) {
    return (
      l.status === "upcoming" &&
      (l.studentState === "normal" ||
        l.studentState === "moved_out" ||
        l.studentState === "pending_out") &&
      new Date(`${l.date}T${l.startTime}`).getTime() > now.getTime()
    );
  }
  const termByLessonId = new Map<string, TermRow | null>();
  for (const l of lessonRows) {
    if (isManageable(l)) termByLessonId.set(l.id, resolveTerm(l.date, terms));
  }
  const distinctTermIds = Array.from(
    new Set(
      Array.from(termByLessonId.values())
        .filter((t): t is TermRow => t !== null)
        .map((t) => t.id),
    ),
  );
  const usageByTerm = new Map<
    string,
    {
      cancelUsed: number;
      rescheduleUsed: number;
      cancelBonus: number;
      rescheduleBonus: number;
    }
  >();
  await Promise.all(
    distinctTermIds.map(async (termId) => {
      const [cancelUsed, rescheduleUsed, bonus] = await Promise.all([
        getCancellationsUsed(studentId, termId),
        getReschedulesUsed(studentId, termId),
        getAllowanceBonus(studentId, termId),
      ]);
      usageByTerm.set(termId, {
        cancelUsed,
        rescheduleUsed,
        cancelBonus: bonus.cancellation,
        rescheduleBonus: bonus.reschedule,
      });
    }),
  );
  // A lesson that's already been cancelled (a class credit already granted)
  // must not also be cancellable or reschedulable - either would double-grant
  // a credit or create a real makeup for a lesson the student is no longer
  // attending. `studentState` alone doesn't reflect this (it only tracks
  // reschedule-based moves), so check `lessonCancellations` directly. A
  // lesson already converted to a no-slot reschedule credit needs the same
  // treatment - it has no `lessonCancellations` row, only a `classCredits`
  // row, so it's checked separately.
  const [cancelledLessonIds, creditGrantedLessonIds] = await Promise.all([
    getCancelledLessonIds(studentId, lessonRows.map((l) => l.id)),
    getCreditGrantedLessonIds(studentId, lessonRows.map((l) => l.id)),
  ]);

  return lessonRows.map((l) => {
    const canManage = isManageable(l);
    const alreadyCancelled = cancelledLessonIds.has(l.id);
    const creditGranted = creditGrantedLessonIds.has(l.id);
    const term = termByLessonId.get(l.id) ?? null;
    const usage = term ? usageByTerm.get(term.id) : undefined;
    const cancelRemaining = usage
      ? remaining(CANCEL_CAP + usage.cancelBonus, usage.cancelUsed)
      : null;
    const rescheduleRemaining = usage
      ? remaining(RESCHEDULE_CAP + usage.rescheduleBonus, usage.rescheduleUsed)
      : null;
    // Cancel is narrower than the shared "canManage" base: a lesson that's
    // already been moved (moved_out/pending_out) must not also be
    // cancellable - that would grant a second credit for the same slot
    // while the make-up lesson still stands. Reschedule intentionally
    // keeps the wider base (re-rescheduling a moved lesson is safe - it
    // just supersedes the previous move) but both exclude an already-
    // cancelled lesson.
    const canCancel =
      canManage &&
      l.studentState === "normal" &&
      !alreadyCancelled &&
      !creditGranted &&
      term !== null &&
      meetsCancelNotice(now, l.date, l.startTime) &&
      (cancelRemaining ?? 0) > 0;
    const canReschedule =
      canManage &&
      !alreadyCancelled &&
      !creditGranted &&
      term !== null &&
      meetsRescheduleNotice(now, l.date, l.startTime) &&
      (rescheduleRemaining ?? 0) > 0;
    // Every lesson opens the action menu; when an action is unavailable it is
    // shown greyed-out with this short reason instead of being hidden.
    const passed =
      l.status !== "upcoming" ||
      new Date(`${l.date}T${l.startTime}`).getTime() <= now.getTime();
    function rescheduleReasonFor(): string | null {
      if (canReschedule) return null;
      if (passed) return "Passed";
      if (alreadyCancelled) return "Cancelled";
      if (creditGranted) return "Credit issued";
      if (!canManage) return "Not reschedulable";
      if (term === null) return "No term set";
      if (!meetsRescheduleNotice(now, l.date, l.startTime))
        return "Needs 7 days notice";
      return "No reschedules left this term";
    }
    function cancelReasonFor(): string | null {
      if (canCancel) return null;
      if (passed) return "Passed";
      if (alreadyCancelled) return "Cancelled";
      if (creditGranted) return "Credit issued";
      if (l.studentState !== "normal") return "Already moved";
      if (term === null) return "No term set";
      if (!meetsCancelNotice(now, l.date, l.startTime))
        return "Needs 24 hours notice";
      return "No cancellations left this term";
    }
    return {
      id: l.id,
      date: l.date,
      startTime: l.startTime,
      endTime: l.endTime,
      status: l.status,
      subjectId: l.subjectId,
      subjectName: l.subjectName,
      className: l.className,
      studentState: l.studentState,
      moveLabel: l.moveLabel,
      canManage,
      canReschedule,
      canCancel,
      rescheduleRemaining,
      cancelRemaining,
      rescheduleReason: rescheduleReasonFor(),
      cancelReason: cancelReasonFor(),
      cancelled: alreadyCancelled,
    };
  });
}
