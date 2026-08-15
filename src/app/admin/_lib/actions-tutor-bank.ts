"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { tutorBankDetails } from "@/db/schema";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { withActor } from "@/lib/with-actor";

const schema = z.object({
  tutorId: z.string().uuid(),
  accountName: z.string().max(120).optional(),
  bsb: z.string().max(20).optional(),
  accountNumber: z.string().max(40).optional(),
  note: z.string().max(500).optional(),
});

function clean(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

/**
 * Upsert a tutor's payroll bank details. Owner-only (PII) - reception is
 * bounced by requireUnrestrictedAdmin. Audited via withActor. Empty fields are
 * stored as NULL so clearing a field works.
 */
export async function setTutorBankDetails(input: z.infer<typeof schema>) {
  const user = await requireUnrestrictedAdmin();
  const data = schema.parse(input);

  const values = {
    tutorId: data.tutorId,
    accountName: clean(data.accountName),
    bsb: clean(data.bsb),
    accountNumber: clean(data.accountNumber),
    note: clean(data.note),
    updatedById: user.id,
    updatedAt: new Date(),
  };

  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .insert(tutorBankDetails)
      .values(values)
      .onConflictDoUpdate({
        target: tutorBankDetails.tutorId,
        set: {
          accountName: values.accountName,
          bsb: values.bsb,
          accountNumber: values.accountNumber,
          note: values.note,
          updatedById: values.updatedById,
          updatedAt: sql`now()`,
        },
      }),
  );

  revalidatePath("/admin/tutors");
  return { ok: true as const };
}
