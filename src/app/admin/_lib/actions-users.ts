"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, profiles } from "@/db/schema";
import { createAdminClient } from "./supabase-admin";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { coarseRole, isUnrestrictedAdmin } from "@/lib/roles";
import { getPinHash, isAdminUnlocked } from "@/lib/admin-lock";
import type { UserRole } from "@/db/schema";

/** The signed-in admin's tiered role (from server-only app_metadata). */
function currentAdminRole(
  user: Awaited<ReturnType<typeof requireAdmin>>,
): UserRole | undefined {
  return (user.app_metadata as Record<string, unknown> | undefined)?.role as
    | UserRole
    | undefined;
}

/**
 * PIN step-up gate. When an admin PIN is configured, sensitive actions
 * (role change, account deactivation) require an active unlock; when no PIN is
 * set yet, the gate is a no-op so the owner is never locked out of their own
 * account management.
 */
async function pinStepUp() {
  const pinHash = await getPinHash();
  if (pinHash && !(await isAdminUnlocked())) {
    return {
      ok: false as const,
      error:
        "Enter the admin PIN in Settings to unlock this action (stays unlocked ~30 min).",
    };
  }
  return { ok: true as const };
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
  password: z.string().min(8).max(128),
  role: roleEnum,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(40).optional(),
  yearLevel: z.string().max(40).optional(),
  school: z.string().max(200).optional(),
});

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const user = await requireAdmin();
  const data = createUserSchema.parse(input);

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
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(40).optional().nullable(),
  yearLevel: z.string().max(40).optional().nullable(),
  school: z.string().max(200).optional().nullable(),
  role: roleEnum,
});

export async function updateUser(input: z.infer<typeof updateUserSchema>) {
  const user = await requireAdmin();
  const data = updateUserSchema.parse(input);

  // Changing a user's role is owner-only and behind the PIN step-up. Editing
  // the other profile fields (name/phone/school) stays open to reception.
  const [existing] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, data.id));
  const roleChanging = !!existing && existing.role !== data.role;
  if (roleChanging) {
    if (!isUnrestrictedAdmin(currentAdminRole(user))) {
      return {
        ok: false as const,
        error: "Only an owner-level admin can change a user's role.",
      };
    }
    const gate = await pinStepUp();
    if (!gate.ok) return gate;
  }

  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
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
      .where(eq(profiles.id, data.id)),
  );

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
  const user = await requireAdmin();
  z.string().uuid().parse(id);

  // Deactivating (banning) an account is behind the PIN step-up. Reactivation
  // is left open so a lockout mistake can always be reversed.
  if (!isActive) {
    const gate = await pinStepUp();
    if (!gate.ok) return gate;
  }

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
