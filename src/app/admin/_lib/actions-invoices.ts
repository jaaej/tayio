"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, invoices, notifications, profiles } from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import {
  OPEN_STATUSES,
  PAYMENT_REMINDER_TITLE,
  buildPaymentReminderBody,
  paymentReminderDedupeKey,
} from "@/app/admin/payments/_lib/families";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";

const statusEnum = z.enum([
  "unpaid",
  "paid",
  "overdue",
  "partially_paid",
  "refunded",
  "cancelled",
]);

const createInvoiceSchema = z.object({
  parentId: z.string().uuid(),
  studentId: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive().multipleOf(0.01),
  currency: z.string().min(3).max(3).default("AUD"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(1000).optional(),
});

/**
 * The billed account must be a parent and, when a student is named, that
 * student must be linked to the parent - otherwise the invoice would show in
 * the wrong family's portal.
 */
async function billingError(
  parentId: string,
  studentId: string | null | undefined,
): Promise<string | null> {
  const profileIds = [parentId, studentId].filter(
    (value): value is string => Boolean(value),
  );
  const people = await db
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles)
    .where(inArray(profiles.id, profileIds));
  const parent = people.find((person) => person.id === parentId);
  if (!parent || coarseRole(parent.role) !== "parent") {
    return "Select a valid parent account.";
  }
  if (studentId) {
    const student = people.find((person) => person.id === studentId);
    if (!student || coarseRole(student.role) !== "student") {
      return "Select a valid student account.";
    }
    const [link] = await db
      .select({ parentId: familyLinks.parentId })
      .from(familyLinks)
      .where(
        and(
          eq(familyLinks.parentId, parentId),
          eq(familyLinks.studentId, studentId),
        ),
      )
      .limit(1);
    if (!link) return "That student is not linked to the selected parent.";
  }
  return null;
}

export async function createInvoice(input: z.input<typeof createInvoiceSchema>) {
  const user = await requireAdmin();
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Check the invoice details.",
    };
  }
  const data = parsed.data;
  const invalid = await billingError(data.parentId, data.studentId);
  if (invalid) return { ok: false as const, error: invalid };
  const row = await withActor({ id: user.id, role: "admin" }, async (tx) => {
    const [r] = await tx
      .insert(invoices)
      .values({
        parentId: data.parentId,
        studentId: data.studentId || null,
        amount: data.amount.toFixed(2),
        currency: data.currency.toUpperCase(),
        dueDate: data.dueDate,
        description: data.description ?? null,
        status: "unpaid",
      })
      .returning({ id: invoices.id });
    return r;
  });
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true as const, id: row.id };
}

export async function markInvoicePaid(id: string) {
  const user = await requireAdmin();
  z.string().uuid().parse(id);
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .update(invoices)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(invoices.id, id)),
  );
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function setInvoiceStatus(
  id: string,
  status: z.infer<typeof statusEnum>,
) {
  const user = await requireAdmin();
  z.string().uuid().parse(id);
  statusEnum.parse(status);
  await withActor({ id: user.id, role: "admin" }, async (tx) => {
    const [current] = await tx
      .select({ paidAt: invoices.paidAt })
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);
    if (!current) throw new Error("Invoice not found");
    await tx
      .update(invoices)
      .set({
        status,
        paidAt:
          status === "paid"
            ? (current.paidAt ?? new Date())
            : status === "refunded"
              ? current.paidAt
              : null,
      })
      .where(eq(invoices.id, id));
  });
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true as const };
}

const updateInvoiceSchema = createInvoiceSchema.extend({
  id: z.string().uuid(),
  status: statusEnum,
  paidDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export async function updateInvoice(
  input: z.input<typeof updateInvoiceSchema>,
) {
  const user = await requireAdmin();
  const data = updateInvoiceSchema.parse(input);

  const invalid = await billingError(data.parentId, data.studentId);
  if (invalid) return { ok: false as const, error: invalid };

  let paidAt: Date | null = null;
  if (data.status === "paid" || data.status === "refunded") {
    if (!data.paidDate) {
      return {
        ok: false as const,
        error: "Enter the original payment date for a paid or refunded invoice.",
      };
    }
    paidAt = new Date(`${data.paidDate}T00:00:00.000Z`);
  }

  const updated = await withActor(
    { id: user.id, role: "admin" },
    async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({
          parentId: data.parentId,
          studentId: data.studentId || null,
          amount: data.amount.toFixed(2),
          currency: data.currency.toUpperCase(),
          dueDate: data.dueDate,
          description: data.description?.trim() || null,
          status: data.status,
          paidAt,
        })
        .where(eq(invoices.id, data.id))
        .returning({ id: invoices.id });
      return row ?? null;
    },
  );
  if (!updated) return { ok: false as const, error: "Invoice not found." };

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true as const };
}

/**
 * Send one in-app payment reminder to a family's parent covering every open
 * invoice (unpaid, overdue, partially paid). Limited to one per family per
 * Melbourne day by the notification dedupe key, so a double click or a
 * second admin cannot spam the parent.
 */
export async function sendPaymentReminder(parentId: string) {
  const user = await requireAdmin();
  const id = z.string().uuid().safeParse(parentId);
  if (!id.success) return { ok: false as const, error: "Select a valid parent account." };

  const [parent] = await db
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, id.data))
    .limit(1);
  if (!parent || coarseRole(parent.role) !== "parent") {
    return { ok: false as const, error: "Select a valid parent account." };
  }

  const open = await db
    .select({
      amount: invoices.amount,
      currency: invoices.currency,
      status: invoices.status,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.parentId, parent.id),
        inArray(invoices.status, [...OPEN_STATUSES]),
      ),
    );
  if (open.length === 0) {
    return { ok: false as const, error: "This family has nothing owing." };
  }

  const inserted = await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .insert(notifications)
      .values({
        userId: parent.id,
        channel: "in_app",
        title: PAYMENT_REMINDER_TITLE,
        body: buildPaymentReminderBody(open),
        href: "/parent/payments",
        dedupeKey: paymentReminderDedupeKey(parent.id, melbourneDate()),
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id }),
  );
  if (inserted.length === 0) {
    return { ok: false as const, error: "Already reminded today." };
  }

  revalidatePath("/admin/payments");
  return { ok: true as const };
}
