"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { subjectSearchAliases, subjects } from "@/db/schema";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { normalizeSubjectAlias } from "@/lib/directory-search";

const inputSchema = z.object({
  subjectId: z.string().uuid(),
  alias: z
    .string()
    .max(24)
    .refine(
      (value) =>
        value.trim() === "" ||
        /^[a-z0-9][a-z0-9/+&._-]*$/i.test(value.trim()),
      "Use letters, numbers, or / + & . _ - without spaces.",
    ),
});

export async function saveSubjectSearchAlias(input: {
  subjectId: string;
  alias: string;
}) {
  const admin = await requireUnrestrictedAdmin();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Check the shortcut.",
    };
  }

  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.id, parsed.data.subjectId))
    .limit(1);
  if (!subject) return { ok: false as const, error: "Subject not found." };

  const alias = normalizeSubjectAlias(parsed.data.alias);
  try {
    if (!alias) {
      await db
        .delete(subjectSearchAliases)
        .where(eq(subjectSearchAliases.subjectId, subject.id));
    } else {
      await db
        .insert(subjectSearchAliases)
        .values({
          subjectId: subject.id,
          alias,
          updatedById: admin.id,
        })
        .onConflictDoUpdate({
          target: subjectSearchAliases.subjectId,
          set: {
            alias,
            updatedById: admin.id,
            updatedAt: new Date(),
          },
        });
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return {
        ok: false as const,
        error: "That shortcut is already assigned to another subject.",
      };
    }
    return { ok: false as const, error: "The shortcut could not be saved." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");
  return { ok: true as const, alias };
}
