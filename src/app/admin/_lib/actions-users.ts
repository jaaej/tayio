"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, profiles } from "@/db/schema";
import { createAdminClient } from "./supabase-admin";
import { requireAdmin } from "./guard";

const roleEnum = z.enum(["student", "parent", "tutor", "admin"]);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: roleEnum,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  yearLevel: z.string().optional(),
  school: z.string().optional(),
});

export async function createUser(input: z.infer<typeof createUserSchema>) {
  await requireAdmin();
  const data = createUserSchema.parse(input);

  const admin = createAdminClient();
  // Role goes into app_metadata (server-only). user_metadata is user-mutable
  // via supabase.auth.updateUser() — putting role there would let a new user
  // self-promote to admin immediately after creation.
  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    app_metadata: {
      role: data.role,
      first_name: data.firstName,
      last_name: data.lastName,
    },
  });
  if (error || !created.user) {
    return { ok: false as const, error: error?.message ?? "Failed to create user" };
  }

  try {
    await db.insert(profiles).values({
      id: created.user.id,
      role: data.role,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      yearLevel: data.yearLevel ?? null,
      school: data.school ?? null,
    });
  } catch (e) {
    // Roll back the auth user so we don't leak orphans
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to insert profile",
    };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true as const, id: created.user.id };
}

const updateUserSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().nullable(),
  yearLevel: z.string().optional().nullable(),
  school: z.string().optional().nullable(),
  role: roleEnum,
});

export async function updateUser(input: z.infer<typeof updateUserSchema>) {
  await requireAdmin();
  const data = updateUserSchema.parse(input);

  await db
    .update(profiles)
    .set({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      yearLevel: data.yearLevel || null,
      school: data.school || null,
      role: data.role,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, data.id));

  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(data.id, {
    app_metadata: {
      role: data.role,
      first_name: data.firstName,
      last_name: data.lastName,
    },
  });

  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function setUserActive(id: string, isActive: boolean) {
  await requireAdmin();
  z.string().uuid().parse(id);

  await db
    .update(profiles)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(profiles.id, id));

  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(id, {
    ban_duration: isActive ? "none" : "8760h",
  });

  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function sendPasswordReset(email: string) {
  await requireAdmin();
  z.string().email().parse(email);
  const admin = createAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(email);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

const familyLinkSchema = z.object({
  parentId: z.string().uuid(),
  studentId: z.string().uuid(),
  relationship: z.string().min(1).default("parent"),
});

export async function createFamilyLink(input: z.infer<typeof familyLinkSchema>) {
  await requireAdmin();
  const data = familyLinkSchema.parse(input);

  const [parent] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, data.parentId));
  const [student] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, data.studentId));

  if (!parent || parent.role !== "parent") {
    return { ok: false as const, error: "Parent account not found" };
  }
  if (!student || student.role !== "student") {
    return { ok: false as const, error: "Student account not found" };
  }

  await db
    .insert(familyLinks)
    .values({
      parentId: data.parentId,
      studentId: data.studentId,
      relationship: data.relationship,
    })
    .onConflictDoNothing();

  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function removeFamilyLink(parentId: string, studentId: string) {
  await requireAdmin();
  z.string().uuid().parse(parentId);
  z.string().uuid().parse(studentId);

  await db
    .delete(familyLinks)
    .where(
      and(eq(familyLinks.parentId, parentId), eq(familyLinks.studentId, studentId)),
    );

  revalidatePath("/admin/users");
  return { ok: true as const };
}
