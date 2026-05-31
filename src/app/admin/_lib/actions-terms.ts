"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { terms } from "@/db/schema";
import { requireRole } from "@/lib/auth";

const termInputSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  termNumber: z.coerce.number().int().min(1).max(4),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createTerm(formData: FormData) {
  await requireRole("admin");
  const parsed = termInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };

  try {
    await db.insert(terms).values(parsed.data);
    revalidatePath("/admin/terms");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function updateTerm(id: string, formData: FormData) {
  await requireRole("admin");
  const parsed = termInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };

  try {
    await db.update(terms).set(parsed.data).where(eq(terms.id, id));
    revalidatePath("/admin/terms");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function deleteTerm(id: string) {
  await requireRole("admin");
  try {
    await db.delete(terms).where(eq(terms.id, id));
    revalidatePath("/admin/terms");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
