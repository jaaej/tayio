"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./guard";
import {
  grantAllowance,
  grantCreditAsAdmin,
  undoCancellation,
  undoRedemption,
  undoReschedule,
} from "@/lib/admin-credits";

type ActionResult = { ok: true } | { ok: false; error: string };

const uuid = z.string().uuid();

function revalidate(studentId: string) {
  revalidatePath(`/admin/users/${studentId}`);
  revalidatePath("/admin/reschedules");
}

export async function grantCreditToStudent(input: {
  studentId: string;
  subjectId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ studentId: uuid, subjectId: uuid })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const res = await grantCreditAsAdmin({
    studentId: parsed.data.studentId,
    subjectId: parsed.data.subjectId,
    grantedById: admin.id,
  });
  if (!res.ok) return res;
  revalidate(parsed.data.studentId);
  return { ok: true };
}

export async function grantAllowanceToStudent(input: {
  studentId: string;
  termId: string;
  kind: "reschedule" | "cancellation";
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      studentId: uuid,
      termId: uuid,
      kind: z.enum(["reschedule", "cancellation"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  try {
    await grantAllowance({
      studentId: parsed.data.studentId,
      termId: parsed.data.termId,
      kind: parsed.data.kind,
      bonus: 1,
      grantedById: admin.id,
    });
  } catch {
    return { ok: false, error: "Couldn't grant that allowance - try again." };
  }
  revalidate(parsed.data.studentId);
  return { ok: true };
}

export async function undoRescheduleForStudent(input: {
  rescheduleRequestId: string;
  studentId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ rescheduleRequestId: uuid, studentId: uuid })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const res = await undoReschedule({
    rescheduleRequestId: parsed.data.rescheduleRequestId,
    adminId: admin.id,
  });
  if (!res.ok) return res;
  revalidate(parsed.data.studentId);
  return { ok: true };
}

export async function undoCancellationForStudent(input: {
  cancellationId: string;
  studentId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ cancellationId: uuid, studentId: uuid })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const res = await undoCancellation({
    cancellationId: parsed.data.cancellationId,
    adminId: admin.id,
  });
  if (!res.ok) return res;
  revalidate(parsed.data.studentId);
  return { ok: true };
}

export async function undoRedemptionForStudent(input: {
  creditId: string;
  studentId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ creditId: uuid, studentId: uuid })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const res = await undoRedemption({
    creditId: parsed.data.creditId,
    adminId: admin.id,
  });
  if (!res.ok) return res;
  revalidate(parsed.data.studentId);
  return { ok: true };
}
