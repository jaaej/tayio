"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, subjects, termReportEntries, termReportIssues, terms } from "@/db/schema";
import type { UserRole } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { coarseRole } from "@/lib/roles";
import { getStudentTermReport, type ReportEntry, type SubjectReport } from "@/lib/student-report";
import { getReportWritingTerm, subjectTutorsInTerm, type ReportTerm } from "@/lib/term-report-entries";
import { checkEntry } from "@/lib/term-report-entry-rules";
import { formatDateLong } from "@/lib/format";
import { withActor } from "@/lib/with-actor";

const keySchema = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  subjectId: z.string().uuid(),
});

const entrySchema = keySchema.extend({
  strengths: z.string().max(4000),
  toWorkOn: z.string().max(4000),
  goals: z.string().max(4000),
});

type Writer = { id: string; role: "admin" | "tutor" };

async function currentWriter(): Promise<Writer | null> {
  const user = await getCurrentUser();
  const role = user?.app_metadata?.role as UserRole | undefined;
  if (!user || !role) return null;
  const coarse = coarseRole(role);
  return coarse === "admin" || coarse === "tutor" ? { id: user.id, role: coarse } : null;
}

async function loadTerm(termId: string): Promise<ReportTerm | null> {
  const [term] = await db
    .select({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .where(eq(terms.id, termId))
    .limit(1);
  return term ?? null;
}

/**
 * Whether this person may write this part, and if not, why. An admin may
 * always; a tutor only for a student they taught in this subject this term,
 * while the term's reports are open and before it has gone to the family.
 */
async function writeRefusal(
  writer: Writer,
  key: z.infer<typeof keySchema>,
  term: ReportTerm,
): Promise<string | null> {
  if (writer.role === "admin") return null;
  const tutors = await subjectTutorsInTerm(key.studentId, key.subjectId, term);
  if (!tutors.includes(writer.id)) return "Only this student's tutor in this subject can write this part.";
  const open = await getReportWritingTerm();
  if (open?.id !== term.id) return "Reports for this term are closed. Ask an admin to change it.";
  const [issued] = await db
    .select({ issuedAt: termReportIssues.issuedAt })
    .from(termReportIssues)
    .where(and(eq(termReportIssues.studentId, key.studentId), eq(termReportIssues.termId, key.termId)))
    .limit(1);
  if (issued) {
    return `This report went to the family on ${formatDateLong(issued.issuedAt)}. Ask an admin to change it.`;
  }
  return null;
}

export type ReportEntryContext = {
  studentName: string;
  subjectName: string;
  termLabel: string;
  /** This subject's numbers for the term, to write from. */
  subject: Omit<SubjectReport, "entry">;
  entry: ReportEntry | null;
  /** Set when this person can read the part but not change it. */
  readOnly: string | null;
};

/** Everything the report writer shows for one student's subject. */
export async function getReportEntryContext(
  input: z.input<typeof keySchema>,
): Promise<{ ok: true; context: ReportEntryContext } | { ok: false; error: string }> {
  const writer = await currentWriter();
  if (!writer) return { ok: false, error: "Sign in as a tutor or admin." };
  const key = keySchema.parse(input);
  const term = await loadTerm(key.termId);
  if (!term) return { ok: false, error: "That term no longer exists." };
  if (writer.role === "tutor") {
    const tutors = await subjectTutorsInTerm(key.studentId, key.subjectId, term);
    if (!tutors.includes(writer.id)) return { ok: false, error: "You didn't teach this student this subject this term." };
  }
  const report = await getStudentTermReport(key.studentId, key.termId);
  const subject = report?.subjects.find((s) => s.subjectId === key.subjectId);
  if (!report || !subject) return { ok: false, error: "They had no class in this subject this term." };
  const { entry, ...numbers } = subject;
  return {
    ok: true,
    context: {
      studentName: `${report.student.firstName} ${report.student.lastName}`.trim(),
      subjectName: subject.subjectName,
      termLabel: `${term.year} Term ${term.termNumber}`,
      subject: numbers,
      entry,
      readOnly: await writeRefusal(writer, key, term),
    },
  };
}

/** Save the tutor's part of a student's term report for one subject. */
export async function saveTermReportEntry(
  input: z.input<typeof entrySchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const writer = await currentWriter();
  if (!writer) return { ok: false, error: "Sign in as a tutor or admin." };
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some fields are not valid. Check and try again." };
  const data = parsed.data;
  const invalid = checkEntry(data);
  if (invalid) return { ok: false, error: invalid };

  const term = await loadTerm(data.termId);
  if (!term) return { ok: false, error: "That term no longer exists." };
  const [[student], [subject]] = await Promise.all([
    db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, data.studentId)).limit(1),
    db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, data.subjectId)).limit(1),
  ]);
  if (!student || coarseRole(student.role) !== "student" || !subject) {
    return { ok: false, error: "That student or subject no longer exists." };
  }
  if ((await subjectTutorsInTerm(data.studentId, data.subjectId, term)).length === 0) {
    return { ok: false, error: "They had no class in this subject this term." };
  }
  const refusal = await writeRefusal(writer, data, term);
  if (refusal) return { ok: false, error: refusal };

  const now = new Date();
  const values = {
    strengths: data.strengths.trim(),
    toWorkOn: data.toWorkOn.trim(),
    goals: data.goals.trim(),
    writtenBy: writer.id,
    updatedAt: now,
  };
  await withActor({ id: writer.id, role: writer.role }, (tx) =>
    tx
      .insert(termReportEntries)
      .values({ studentId: data.studentId, termId: data.termId, subjectId: data.subjectId, ...values })
      .onConflictDoUpdate({
        target: [termReportEntries.studentId, termReportEntries.termId, termReportEntries.subjectId],
        set: values,
      }),
  );

  revalidatePath("/tutor/reports");
  revalidatePath("/tutor");
  revalidatePath("/admin/reports");
  return { ok: true };
}
