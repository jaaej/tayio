import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  classWeekPlanAttachments,
  classWeekPlans,
  enrollments,
  familyLinks,
  homework,
  homeworkAssignments,
  subjectWeeks,
  type UserRole,
} from "@/db/schema";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import { HOMEWORK_ATTACHMENT_BUCKET, HOMEWORK_BUCKET } from "@/app/student/homework/_storage";
import { tutorHomeworkFilter } from "@/app/tutor/_lib/homework-access";
import { BUCKET as CURRICULUM_BUCKET } from "@/lib/curriculum-storage";
import { canStudentAccessCurriculumWeek } from "@/lib/curriculum-access";
import { canSubmitHomework, isFeedbackReleased } from "@/lib/homework-rules";
import { homeworkSolutionIsAvailable } from "@/lib/homework-solution";
import { enrolledSubjectIds, getResourceForViewer } from "@/lib/resources";
import { coarseRole } from "@/lib/roles";
import { markupFileKind, type MarkupFileKind } from "./doc";

/*
 * Which file a viewer is writing on, and who may write or see what. Every
 * open and every save comes through `resolveMarkupTarget`, so the access
 * rules live in one place:
 * - A student writes private notes on files they can open: a homework's
 *   worksheet or released solution, a week booklet, a file in their class's
 *   week plan, a library resource. Nobody else sees them.
 * - The homework's tutor writes feedback on a student's submitted file; the
 *   student and their linked parents see it once the work is marked or sent
 *   back for a resubmission.
 * Admins and parents never write; tutors never write notes. Only PDFs, PNGs
 * and JPEGs can be written on.
 */

const uuid = z.string().uuid();

export const markupTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("homework-sheet"), homeworkId: uuid, sheet: z.enum(["worksheet", "solution"]) }),
  z.object({ kind: z.literal("submission"), homeworkId: uuid, studentId: uuid }),
  z.object({ kind: z.literal("booklet"), subjectWeekId: uuid }),
  z.object({ kind: z.literal("plan-file"), attachmentId: uuid }),
  z.object({ kind: z.literal("resource"), resourceId: uuid }),
]);

export type MarkupTarget = z.infer<typeof markupTargetSchema>;

export type MarkupLayerKey = { layer: "notes" | "feedback"; ownerId: string };

export type ResolvedMarkupTarget = {
  file: { bucket: string; path: string; kind: MarkupFileKind; downloadName: string };
  /** The layer this viewer writes, or null to only look. */
  edit: MarkupLayerKey | null;
  /** Other people's marks shown on top, read only. */
  show: MarkupLayerKey[];
  /** A worksheet the student can hand in with their writing on it. */
  canSubmit: boolean;
  /** The pen colour a new mark starts with: red for a tutor's marking. */
  defaultPen: "ink" | "red";
};

type Viewer = { id: string; role: UserRole };

function storedPath(value: string | null | undefined): string | null {
  return value && !value.startsWith("http") ? value : null;
}

function fileFor(
  bucket: string,
  path: string | null | undefined,
  contentType: string | null,
  title: string,
): ResolvedMarkupTarget["file"] | null {
  const stored = storedPath(path);
  if (!stored) return null;
  const kind = markupFileKind(stored, contentType);
  if (!kind) return null;
  const ext = kind === "jpeg" ? "jpg" : kind;
  const safeTitle = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").trim().slice(0, 120) || "File";
  return { bucket, path: stored, kind, downloadName: `${safeTitle}.${ext}` };
}

/**
 * The file and layers for `target` as `viewer` may use them, or null when
 * they may not open it here (or it is not a PDF or picture).
 */
export async function resolveMarkupTarget(
  viewer: Viewer,
  target: MarkupTarget,
): Promise<ResolvedMarkupTarget | null> {
  const role = coarseRole(viewer.role);
  switch (target.kind) {
    case "homework-sheet": {
      if (role !== "student") return null;
      const [row] = await db
        .select({
          title: homework.title,
          attachmentUrl: homework.attachmentUrl,
          solutionUrl: homework.solutionUrl,
          dueDate: homework.dueDate,
          allowResubmission: homework.allowResubmission,
          status: homeworkAssignments.status,
        })
        .from(homeworkAssignments)
        .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
        .where(
          and(
            eq(homeworkAssignments.homeworkId, target.homeworkId),
            eq(homeworkAssignments.studentId, viewer.id),
          ),
        )
        .limit(1);
      if (!row) return null;
      if (target.sheet === "solution") {
        if (!homeworkSolutionIsAvailable({ solutionUrl: row.solutionUrl, dueDate: row.dueDate })) return null;
        const file = fileFor(HOMEWORK_ATTACHMENT_BUCKET, row.solutionUrl, null, `${row.title} solution`);
        return file && notes(file, viewer.id);
      }
      const file = fileFor(HOMEWORK_ATTACHMENT_BUCKET, row.attachmentUrl, null, `${row.title} worksheet`);
      if (!file) return null;
      return { ...notes(file, viewer.id), canSubmit: canSubmitHomework(row.status, row.allowResubmission) };
    }

    case "submission": {
      const [row] = await db
        .select({
          title: homework.title,
          submissionUrl: homeworkAssignments.submissionUrl,
          status: homeworkAssignments.status,
        })
        .from(homeworkAssignments)
        .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
        .where(
          and(
            eq(homeworkAssignments.homeworkId, target.homeworkId),
            eq(homeworkAssignments.studentId, target.studentId),
          ),
        )
        .limit(1);
      if (!row) return null;
      const file = fileFor(HOMEWORK_BUCKET, row.submissionUrl, null, `${row.title} submission`);
      if (!file) return null;
      const feedback: MarkupLayerKey = { layer: "feedback", ownerId: target.studentId };
      if (role === "tutor") {
        const [owns] = await db
          .select({ id: homework.id })
          .from(homework)
          .where(and(eq(homework.id, target.homeworkId), tutorHomeworkFilter(viewer.id)))
          .limit(1);
        if (!owns) return null;
        return { file, edit: feedback, show: [], canSubmit: false, defaultPen: "red" };
      }
      const released = isFeedbackReleased(row.status);
      if (role === "student") {
        if (viewer.id !== target.studentId) return null;
      } else if (role === "parent") {
        const [link] = await db
          .select({ parentId: familyLinks.parentId })
          .from(familyLinks)
          .where(and(eq(familyLinks.parentId, viewer.id), eq(familyLinks.studentId, target.studentId)))
          .limit(1);
        if (!link) return null;
      } else {
        return null;
      }
      return { file, edit: null, show: released ? [feedback] : [], canSubmit: false, defaultPen: "ink" };
    }

    case "booklet": {
      if (role !== "student") return null;
      if (!(await canStudentAccessCurriculumWeek(viewer.id, target.subjectWeekId))) return null;
      const [week] = await db
        .select({ title: subjectWeeks.title, bookletUrl: subjectWeeks.bookletUrl })
        .from(subjectWeeks)
        .where(eq(subjectWeeks.id, target.subjectWeekId))
        .limit(1);
      const file = week && fileFor(CURRICULUM_BUCKET, week.bookletUrl, null, `${week.title} booklet`);
      return file ? notes(file, viewer.id) : null;
    }

    case "plan-file": {
      if (role !== "student") return null;
      const [row] = await db
        .select({
          fileName: classWeekPlanAttachments.fileName,
          kind: classWeekPlanAttachments.kind,
          storagePath: classWeekPlanAttachments.storagePath,
          contentType: classWeekPlanAttachments.contentType,
          subjectWeekId: classWeekPlans.subjectWeekId,
        })
        .from(classWeekPlanAttachments)
        .innerJoin(classWeekPlans, eq(classWeekPlans.id, classWeekPlanAttachments.planId))
        .innerJoin(
          enrollments,
          and(
            eq(enrollments.classId, classWeekPlans.classId),
            eq(enrollments.studentId, viewer.id),
            isNull(enrollments.withdrawnAt),
          ),
        )
        .where(eq(classWeekPlanAttachments.id, target.attachmentId))
        .limit(1);
      if (!row || row.kind !== "file") return null;
      if (!(await canStudentAccessCurriculumWeek(viewer.id, row.subjectWeekId))) return null;
      const title = row.fileName.replace(/\.[a-z0-9]{1,5}$/i, "");
      const file = fileFor(CURRICULUM_BUCKET, row.storagePath, row.contentType, title);
      return file ? notes(file, viewer.id) : null;
    }

    case "resource": {
      if (role !== "student") return null;
      const row = await getResourceForViewer(target.resourceId, await enrolledSubjectIds(viewer.id));
      if (!row || row.kind !== "file" || !row.storageBucket) return null;
      const file = fileFor(row.storageBucket, row.storagePath, row.contentType, row.title);
      return file ? notes(file, viewer.id) : null;
    }
  }
}

function notes(file: ResolvedMarkupTarget["file"], studentId: string): ResolvedMarkupTarget {
  return { file, edit: { layer: "notes", ownerId: studentId }, show: [], canSubmit: false, defaultPen: "ink" };
}

/**
 * The storage object's version, which changes when a file is replaced at the
 * same path. Empty when storage does not say, so marks still save.
 */
export async function storedFileVersion(bucket: string, path: string): Promise<string> {
  const { data } = await createAdminClient().storage.from(bucket).info(path);
  return data?.version ?? "";
}

/** The viewer signed in for an API route, or null. */
export function viewerFromUser(user: { id: string; app_metadata?: Record<string, unknown> } | null): Viewer | null {
  const role = user?.app_metadata?.role as UserRole | undefined;
  return user && role ? { id: user.id, role } : null;
}
