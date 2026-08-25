"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, profiles } from "@/db/schema";
import { createAdminClient } from "./supabase-admin";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { coarseRole, isUnrestrictedAdmin } from "@/lib/roles";
import type { UserRole } from "@/db/schema";

/** The signed-in admin's tiered role (from server-only app_metadata). */
function currentAdminRole(
  user: Awaited<ReturnType<typeof requireAdmin>>,
): UserRole | undefined {
  return (user.app_metadata as Record<string, unknown> | undefined)?.role as
    | UserRole
    | undefined;
}

// Accepts tiered roles; legacy coarse values kept for safety on any un-migrated
// caller. New/edited accounts should always use a tiered value.
const roleEnum = z.enum([
  "student_restricted",
  "student_unrestricted",
  "parent",
  "tutor",
  "admin_restricted",
  "admin_unrestricted",
  "student",
  "admin",
]);

const createUserSchema = z.object({
  email: z.string().email().max(320),
  /** Absent means "generate one" - see `generateTempPassword`. */
  password: z.string().min(8).max(128).optional(),
  role: roleEnum,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(40).optional(),
  yearLevel: z.string().max(40).optional(),
  school: z.string().max(200).optional(),
});

/**
 * Temporary password for an account the admin did not set one for. 12 random
 * bytes is 16 base64url characters (~96 bits); the fixed suffix guarantees a
 * digit and a symbol so it clears any character-class password policy.
 */
function generateTempPassword(): string {
  return `${randomBytes(12).toString("base64url")}7!`;
}

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const user = await requireAdmin();
  // An empty box means "generate one", so normalise it away before validation:
  // the minimum length should only apply to a password an admin actually typed.
  const data = createUserSchema.parse({
    ...input,
    password: input.password?.trim() || undefined,
  });
  const password = data.password ?? generateTempPassword();

  // Creating a privileged account (any admin tier or tutor) is owner-only.
  const targetPrivileged =
    coarseRole(data.role) === "admin" || data.role === "tutor";
  if (targetPrivileged && !isUnrestrictedAdmin(currentAdminRole(user))) {
    return {
      ok: false as const,
      error: "Only an owner-level admin can create admin or tutor accounts.",
    };
  }

  const admin = createAdminClient();
  // Role goes into app_metadata (server-only). user_metadata is user-mutable
  // via supabase.auth.updateUser() - putting role there would let a new user
  // self-promote to admin immediately after creation.
  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email,
    password,
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
  return {
    ok: true as const,
    id: created.user.id,
    // Only handed back when we generated it - there is nothing to reveal about
    // a password the admin typed themselves.
    tempPassword: data.password ? undefined : password,
  };
}

const updateUserSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(320),
  phone: z.string().max(40).optional().nullable(),
  yearLevel: z.string().max(40).optional().nullable(),
  school: z.string().max(200).optional().nullable(),
  role: roleEnum,
});

export async function updateUser(input: z.infer<typeof updateUserSchema>) {
  const user = await requireAdmin();
  const data = updateUserSchema.parse({
    ...input,
    email: input.email.trim().toLowerCase(),
  });

  // Changing a user's role is owner-only and behind the PIN step-up. Editing
  // the other profile fields (name/phone/school) stays open to reception.
  const [existing] = await db
    .select({
      email: profiles.email,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, data.id));
  if (!existing) {
    return { ok: false as const, error: "User account not found." };
  }
  const roleChanging = !!existing && existing.role !== data.role;
  if (roleChanging && !isUnrestrictedAdmin(currentAdminRole(user))) {
    return {
      ok: false as const,
      error: "Only an owner-level admin can change a user's role.",
    };
  }

  const emailChanging = existing.email !== data.email;
  if (emailChanging) {
    const [emailOwner] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, data.email))
      .limit(1);
    if (emailOwner && emailOwner.id !== data.id) {
      return { ok: false as const, error: "That email address is already in use." };
    }
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(data.id, {
    ...(emailChanging ? { email: data.email, email_confirm: true } : {}),
    app_metadata: {
      role: data.role,
      first_name: data.firstName,
      last_name: data.lastName,
    },
  });
  if (authError) {
    return { ok: false as const, error: authError.message };
  }

  try {
    await withActor({ id: user.id, role: "admin" }, (tx) =>
      tx
        .update(profiles)
        .set({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || null,
          yearLevel: data.yearLevel || null,
          school: data.school || null,
          role: data.role,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, data.id)),
    );
  } catch (error) {
    await admin.auth.admin.updateUserById(data.id, {
      ...(emailChanging ? { email: existing.email, email_confirm: true } : {}),
      app_metadata: {
        role: existing.role,
        first_name: existing.firstName,
        last_name: existing.lastName,
      },
    });
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to update user.",
    };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${data.id}`);
  return { ok: true as const };
}

export async function setUserActive(id: string, isActive: boolean) {
  const user = await requireAdmin();
  z.string().uuid().parse(id);

  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .update(profiles)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(profiles.id, id)),
  );

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
  relationship: z.string().min(1).max(60).default("parent"),
});

export async function createFamilyLink(input: z.infer<typeof familyLinkSchema>) {
  const user = await requireAdmin();
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
  if (!student || coarseRole(student.role) !== "student") {
    return { ok: false as const, error: "Student account not found" };
  }

  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .insert(familyLinks)
      .values({
        parentId: data.parentId,
        studentId: data.studentId,
        relationship: data.relationship,
      })
      .onConflictDoNothing(),
  );

  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function removeFamilyLink(parentId: string, studentId: string) {
  const user = await requireAdmin();
  z.string().uuid().parse(parentId);
  z.string().uuid().parse(studentId);

  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .delete(familyLinks)
      .where(
        and(eq(familyLinks.parentId, parentId), eq(familyLinks.studentId, studentId)),
      ),
  );

  revalidatePath("/admin/users");
  return { ok: true as const };
}

/**
 * Mark (or unmark) a parent as the primary contact for a student. A student has
 * at most one primary contact, so setting one clears any other primary link for
 * that student in the same transaction. Unsetting leaves the student with no
 * explicit primary (the student is then the de-facto primary contact).
 */
export async function setPrimaryContact(
  parentId: string,
  studentId: string,
  isPrimary: boolean,
) {
  const user = await requireAdmin();
  z.string().uuid().parse(parentId);
  z.string().uuid().parse(studentId);

  await withActor({ id: user.id, role: "admin" }, async (tx) => {
    if (isPrimary) {
      await tx
        .update(familyLinks)
        .set({ isPrimaryContact: false })
        .where(eq(familyLinks.studentId, studentId));
    }
    await tx
      .update(familyLinks)
      .set({ isPrimaryContact: isPrimary })
      .where(
        and(
          eq(familyLinks.parentId, parentId),
          eq(familyLinks.studentId, studentId),
        ),
      );
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parentId}`);
  revalidatePath(`/admin/users/${studentId}`);
  return { ok: true as const };
}
