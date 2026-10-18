"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/admin/ui";
import {
  InteractiveTimetable,
  type TimetableChip,
  type TimetableHw,
} from "@/app/student/_components/interactive-timetable";
import type { LeavePeriod } from "@/lib/student-leave";
import { leaveDays } from "../../_lib/leave-days";
import { MoveLessonPanel, type MovableLesson } from "./move-lesson-panel";
import { lessonStartInstant } from "@/lib/tutor-cover-rules";

/**
 * The student's timetable on their admin profile: the same calendar, lessons
 * and labels the student and parent see (`InteractiveTimetable`, chips from
 * `buildTimetableChips`), with the admin's actions on the selected lesson:
 * move an upcoming lesson (no notice or allowance limits) or open a past
 * lesson's roll.
 */
export function AdminStudentTimetable({
  studentId,
  initialYear,
  initialMonth,
  lessons,
  homework,
  leavePeriods,
}: {
  studentId: string;
  initialYear: number;
  initialMonth: number;
  lessons: TimetableChip[];
  homework: TimetableHw[];
  leavePeriods: LeavePeriod[];
}) {
  const router = useRouter();
  const [moving, setMoving] = useState<MovableLesson | null>(null);
  const shaded = useMemo(() => leaveDays(leavePeriods), [leavePeriods]);

  return (
    <>
      <InteractiveTimetable
        initialYear={initialYear}
        initialMonth={initialMonth}
        lessons={lessons}
        homework={homework}
        credits={[]}
        adminId={null}
        studentId={studentId}
        canSelfServe={false}
        shadedDates={shaded}
        staffActions={(lesson) => (
          <StaffLessonActions
            lesson={lesson}
            onMove={() =>
              setMoving({
                id: lesson.id,
                subjectName: lesson.subjectName,
                date: lesson.date,
                startTime: lesson.startTime,
                endTime: lesson.endTime,
                tutorName: lesson.tutorName,
              })
            }
          />
        )}
      />
      <MoveLessonPanel
        studentId={studentId}
        lesson={moving}
        leavePeriods={leavePeriods}
        onClose={() => setMoving(null)}
        onMoved={() => {
          setMoving(null);
          router.refresh();
        }}
      />
    </>
  );
}

function StaffLessonActions({
  lesson,
  onMove,
}: {
  lesson: TimetableChip;
  onMove: () => void;
}) {
  // A request still waiting for approval is not a lesson yet.
  if (lesson.studentState === "pending_in") return null;
  const started = lessonStartInstant(lesson.date, lesson.startTime).getTime() <= Date.now();
  // The same lessons the admin move accepts: an upcoming lesson the student
  // still has (not cancelled for a credit or turned into one).
  const movable =
    !started && lesson.status === "upcoming" && !lesson.cancelled && !lesson.convertedToCredit;

  return (
    <div className="flex flex-wrap gap-2">
      {movable && (
        <button type="button" onClick={onMove} className={buttonVariants({ variant: "primary" })}>
          Move lesson
        </button>
      )}
      {started && (
        <Link href={`/admin/attendance/${lesson.id}`} className={buttonVariants({ variant: "outline" })}>
          Open roll
        </Link>
      )}
    </div>
  );
}
