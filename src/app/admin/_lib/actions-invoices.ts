"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invoices } from "@/db/schema";
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

export async function createInvoice(input: z.infer<typeof createInvoiceSchema>) {
  const user = await requireAdmin();
  const data = createInvoiceSchema.parse(input);
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
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .update(invoices)
      .set({
        status,
        paidAt: status === "paid" ? new Date() : null,
      })
      .where(eq(invoices.id, id)),
  );
  revalidatePath("/admin/payments");
  return { ok: true as const };
}
