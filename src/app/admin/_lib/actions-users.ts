"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, profiles } from "@/db/schema";
import { createAdminClient } from "./supabase-admin";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import {
  canAdminManageAccount,
  coarseRole,
  isUnrestrictedAdmin,
} from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { passwordSetupRedirect } from "@/lib/site-url";

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

const postalAddressShape = {
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  suburb: z.string().max(100).optional(),
  state: z.string().max(40).optional(),
  postcode: z
    .string()
    .regex(/^\d{4}$/, "Enter a four-digit Australian postcode.")
    .optional(),
};

const linkedParentSchema = z.object({
  email: z.string().email("Enter a valid parent email.").max(320),
  /** Absent means "generate one" - see `generateTempPassword`. */
  password: z.string().min(8).max(128).optional(),
  firstName: z.string().min(1, "Enter the parent's first name.").max(100),
  lastName: z.string().min(1, "Enter the parent's last name.").max(100),
  phone: z.string().max(40).optional(),
  relationship: z.string().min(1).max(60).optional(),
  ...postalAddressShape,
});

const createUserSchema = z
  .object({
    email: z.string().email().max(320),
    /** Absent means "generate one" - see `generateTempPassword`. */
    password: z.string().min(8).max(128).optional(),
    role: roleEnum,
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().max(40).optional(),
    ...postalAddressShape,
    yearLevel: z.string().max(40).optional(),
    school: z.string().max(200).optional(),
    linkedParent: linkedParentSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.linkedParent && coarseRole(data.role) !== "student") {
      ctx.addIssue({
        code: "custom",
        path: ["linkedParent"],
        message: "A parent account can only be linked while creating a student.",
      });
    }
    if (
      data.linkedParent &&
      data.linkedParent.email.toLowerCase() === data.email.toLowerCase()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["linkedParent", "email"],
        message: "The parent and student must use different email addresses.",
      });
    }
  });

/**
 * Temporary password for an account the admin did not set one for. 12 random
 * bytes is 16 base64url characters (~96 bits); the fixed suffix guarantees a
 * digit and a symbol so it clears any character-class password policy.
 */
function generateTempPassword(): string {
  return `${randomBytes(12).toString("base64url")}7!`;
}

type PasswordSetupDelivery =
  | { sent: true }
  | { sent: false; error: string };

/**
 * A newly created account is already confirmed and has a fallback temporary
 * password. A recovery email is therefore the safest setup link: it lands on
 * the existing set-password page without putting credentials in email.
 * Delivery failure must not roll back an otherwise valid account; the admin
 * can still hand over the one-time password and retry from the user menu.
 */
async function sendPasswordSetupEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<PasswordSetupDelivery> {
  try {
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: passwordSetupRedirect(),
    });
    return error
      ? { sent: false, error: error.message }
      : { sent: true };
  } catch (error) {
    return {
      sent: false,
      error:
        error instanceof Error
          ? error.message
          : "The email provider could not be reached.",
    };
  }
}

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const user = await requireAdmin();
  // An empty box means "generate one", so normalise it away before validation:
  // the minimum length should only apply to a password an admin actually typed.
  const parsed = createUserSchema.safeParse({
    ...input,
    email: input.email.trim().toLowerCase(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim() || undefined,
    addressLine1: input.addressLine1?.trim() || undefined,
    addressLine2: input.addressLine2?.trim() || undefined,
    suburb: input.suburb?.trim() || undefined,
    state: input.state?.trim() || undefined,
    postcode: input.postcode?.trim() || undefined,
    yearLevel: input.yearLevel?.trim() || undefined,
    school: input.school?.trim() || undefined,
    password: input.password?.trim() || undefined,
    linkedParent: input.linkedParent
      ? {
          ...input.linkedParent,
          email: input.linkedParent.email.trim().toLowerCase(),
          firstName: input.linkedParent.firstName.trim(),
          lastName: input.linkedParent.lastName.trim(),
          phone: input.linkedParent.phone?.trim() || undefined,
          relationship: input.linkedParent.relationship?.trim() || undefined,
          addressLine1: input.linkedParent.addressLine1?.trim() || undefined,
          addressLine2: input.linkedParent.addressLine2?.trim() || undefined,
          suburb: input.linkedParent.suburb?.trim() || undefined,
          state: input.linkedParent.state?.trim() || undefined,
          postcode: input.linkedParent.postcode?.trim() || undefined,
          password: input.linkedParent.password?.trim() || undefined,
        }
      : undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Check the account details.",
    };
  }
  const data = parsed.data;
  const password = data.password ?? generateTempPassword();
  const parentPassword = data.linkedParent
    ? data.linkedParent.password ?? generateTempPassword()
    : undefined;

  // Creating a privileged account (any admin tier or tutor) is owner-only.
  const targetPrivileged =
    coarseRole(data.role) === "admin" || data.role === "tutor";
  if (targetPrivileged && !isUnrestrictedAdmin(currentAdminRole(user))) {
    return {
      ok: false as const,
      error: "Only an owner-level admin can create admin or tutor accounts.",
    };
  }

  // Deactivation deliberately keeps the Auth user and their operational
  // history. Catch a reused email before Supabase returns a vague duplicate
  // error and direct the admin to the safe reactivation workflow instead.
  const requestedEmails = [
    data.email,
    ...(data.linkedParent ? [data.linkedParent.email] : []),
  ];
  const existingAccounts = await db
    .select({
      email: profiles.email,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      isActive: profiles.isActive,
    })
    .from(profiles)
    .where(inArray(profiles.email, requestedEmails));
  const existing = existingAccounts.find(
    (account) => account.email === data.email,
  );
  if (existing) {
    return {
      ok: false as const,
      error: existing.isActive
        ? "An active account already uses this email address."
        : `This email belongs to the deactivated account for ${existing.firstName} ${existing.lastName}. In Admin → Users, set Status to Discontinued and reactivate that account instead.`,
    };
  }
  const existingParent = data.linkedParent
    ? existingAccounts.find(
        (account) => account.email === data.linkedParent?.email,
      )
    : undefined;
  if (existingParent) {
    return {
      ok: false as const,
      error: existingParent.isActive
        ? "An account already uses the parent email address. Create the student without a new parent, then link the existing parent from the student's profile."
        : `The parent email belongs to the deactivated account for ${existingParent.firstName} ${existingParent.lastName}. Reactivate that account before linking it.`,
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

  let createdParentId: string | undefined;
  if (data.linkedParent && parentPassword) {
    const { data: parentCreated, error: parentError } =
      await admin.auth.admin.createUser({
        email: data.linkedParent.email,
        password: parentPassword,
        email_confirm: true,
        app_metadata: {
          role: "parent",
          first_name: data.linkedParent.firstName,
          last_name: data.linkedParent.lastName,
        },
      });

    if (parentError || !parentCreated.user) {
      await admin.auth.admin.deleteUser(created.user.id);
      return {
        ok: false as const,
        error: `Parent account could not be created: ${
          parentError?.message ?? "unknown error"
        }. The student account was rolled back.`,
      };
    }
    createdParentId = parentCreated.user.id;
  }

  try {
    await withActor(
      { id: user.id, role: currentAdminRole(user) ?? "admin" },
      async (tx) => {
        await tx
          .insert(profiles)
          .values({
            id: created.user.id,
            role: data.role,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone ?? null,
            addressLine1: data.addressLine1 ?? null,
            addressLine2: data.addressLine2 ?? null,
            suburb: data.suburb ?? null,
            state: data.state ?? null,
            postcode: data.postcode ?? null,
            yearLevel: data.yearLevel ?? null,
            school: data.school ?? null,
          })
          .onConflictDoUpdate({
            target: profiles.id,
            set: {
              role: data.role,
              email: data.email,
              firstName: data.firstName,
              lastName: data.lastName,
              phone: data.phone ?? null,
              addressLine1: data.addressLine1 ?? null,
              addressLine2: data.addressLine2 ?? null,
              suburb: data.suburb ?? null,
              state: data.state ?? null,
              postcode: data.postcode ?? null,
              yearLevel: data.yearLevel ?? null,
              school: data.school ?? null,
              updatedAt: new Date(),
            },
          });

        if (data.linkedParent && createdParentId) {
          await tx
            .insert(profiles)
            .values({
              id: createdParentId,
              role: "parent",
              email: data.linkedParent.email,
              firstName: data.linkedParent.firstName,
              lastName: data.linkedParent.lastName,
              phone: data.linkedParent.phone ?? null,
              addressLine1: data.linkedParent.addressLine1 ?? null,
              addressLine2: data.linkedParent.addressLine2 ?? null,
              suburb: data.linkedParent.suburb ?? null,
              state: data.linkedParent.state ?? null,
              postcode: data.linkedParent.postcode ?? null,
            })
            .onConflictDoUpdate({
              target: profiles.id,
              set: {
                role: "parent",
                email: data.linkedParent.email,
                firstName: data.linkedParent.firstName,
                lastName: data.linkedParent.lastName,
                phone: data.linkedParent.phone ?? null,
                addressLine1: data.linkedParent.addressLine1 ?? null,
                addressLine2: data.linkedParent.addressLine2 ?? null,
                suburb: data.linkedParent.suburb ?? null,
                state: data.linkedParent.state ?? null,
                postcode: data.linkedParent.postcode ?? null,
                updatedAt: new Date(),
              },
            });

          await tx
            .insert(familyLinks)
            .values({
              parentId: createdParentId,
              studentId: created.user.id,
              relationship: data.linkedParent.relationship ?? "Parent",
              isPrimaryContact: true,
            })
            .onConflictDoUpdate({
              target: [familyLinks.parentId, familyLinks.studentId],
              set: {
                relationship: data.linkedParent.relationship ?? "Parent",
                isPrimaryContact: true,
              },
            });
        }
      },
    );
  } catch (e) {
    // Roll back both auth users so a failed profile/link transaction cannot
    // leave a half-created family behind.
    if (createdParentId) await admin.auth.admin.deleteUser(createdParentId);
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to create the accounts",
    };
  }

  const [passwordSetupEmail, parentPasswordSetupEmail] = await Promise.all([
    sendPasswordSetupEmail(admin, data.email),
    data.linkedParent
      ? sendPasswordSetupEmail(admin, data.linkedParent.email)
      : Promise.resolve(undefined),
  ]);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return {
    ok: true as const,
    id: created.user.id,
    passwordSetupEmail,
    // Only handed back when we generated it - there is nothing to reveal about
    // a password the admin typed themselves.
    tempPassword: data.password ? undefined : password,
    linkedParent: data.linkedParent
      ? {
          id: createdParentId as string,
          passwordSetupEmail: parentPasswordSetupEmail as PasswordSetupDelivery,
          tempPassword: data.linkedParent.password
            ? undefined
            : parentPassword,
        }
      : undefined,
  };
}

const updateUserSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(320),
  phone: z.string().max(40).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  suburb: z.string().max(100).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  postcode: z
    .string()
    .regex(/^\d{4}$/, "Enter a four-digit Australian postcode.")
    .optional()
    .nullable()
    .or(z.literal("")),
  yearLevel: z.string().max(40).optional().nullable(),
  school: z.string().max(200).optional().nullable(),
  role: roleEnum,
});

export async function updateUser(input: z.infer<typeof updateUserSchema>) {
  const user = await requireAdmin();
  const data = updateUserSchema.parse({
    ...input,
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    addressLine1: input.addressLine1?.trim() || null,
    addressLine2: input.addressLine2?.trim() || null,
    suburb: input.suburb?.trim() || null,
    state: input.state?.trim() || null,
    postcode: input.postcode?.trim() || null,
    yearLevel: input.yearLevel?.trim() || null,
    school: input.school?.trim() || null,
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
  if (!canAdminManageAccount(currentAdminRole(user), existing.role)) {
    return {
      ok: false as const,
      error: "Only an owner-level admin can edit another admin account.",
    };
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
          addressLine1: data.addressLine1 || null,
          addressLine2: data.addressLine2 || null,
          suburb: data.suburb || null,
          state: data.state || null,
          postcode: data.postcode || null,
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

const userAdminNoteSchema = z.object({
  id: z.string().uuid(),
  note: z.string().max(2000, "Keep the internal note under 2,000 characters."),
});

/**
 * Save an account-level note for the admin directory. The note is deliberately
 * separate from class enrolment notes: it works for every role and survives a
 * student moving or withdrawing from a class. Empty text clears it.
 */
export async function setUserAdminNote(
  input: z.infer<typeof userAdminNoteSchema>,
) {
  const user = await requireAdmin();
  const parsed = userAdminNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Check the internal note.",
    };
  }

  const [target] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, parsed.data.id))
    .limit(1);
  if (!target) {
    return { ok: false as const, error: "User account not found." };
  }
  if (!canAdminManageAccount(currentAdminRole(user), target.role)) {
    return {
      ok: false as const,
      error: "Only an owner-level admin can edit another admin account.",
    };
  }

  const note = parsed.data.note.trim();
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .update(profiles)
      .set({
        adminNotes: note.length > 0 ? note : null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, parsed.data.id)),
  );

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.id}`);
  return { ok: true as const, note };
}

export async function setUserActive(id: string, isActive: boolean) {
  const user = await requireAdmin();
  z.string().uuid().parse(id);

  const [target] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  if (!target) return { ok: false as const, error: "User account not found." };
  if (!canAdminManageAccount(currentAdminRole(user), target.role)) {
    return {
      ok: false as const,
      error: "Only an owner-level admin can deactivate or reactivate an admin.",
    };
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

const hardDeleteUserSchema = z.object({
  id: z.string().uuid(),
  confirmationEmail: z.string().email().max(320),
});

/**
 * Permanently remove a deactivated account from both the portal database and
 * Supabase Auth. The profile delete runs inside a transaction so database FK
 * safeguards can refuse accounts with protected business records before the
 * Auth identity is removed. Cascading personal records are intentionally
 * erased: this action is only for duplicate/test/mistaken accounts.
 */
export async function hardDeleteUser(
  input: z.infer<typeof hardDeleteUserSchema>,
) {
  const user = await requireAdmin();
  if (!isUnrestrictedAdmin(currentAdminRole(user))) {
    return {
      ok: false as const,
      error: "Only an owner-level admin can permanently delete an account.",
    };
  }

  const parsed = hardDeleteUserSchema.safeParse({
    ...input,
    confirmationEmail: input.confirmationEmail.trim().toLowerCase(),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Type the account's complete email address to confirm deletion.",
    };
  }
  if (parsed.data.id === user.id) {
    return {
      ok: false as const,
      error: "You cannot permanently delete the account you are signed in with.",
    };
  }

  const [target] = await db
    .select({
      email: profiles.email,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      isActive: profiles.isActive,
    })
    .from(profiles)
    .where(eq(profiles.id, parsed.data.id))
    .limit(1);
  if (!target) {
    return { ok: false as const, error: "User account not found." };
  }
  if (target.isActive) {
    return {
      ok: false as const,
      error: "Deactivate the account before permanently deleting it.",
    };
  }
  if (target.email.toLowerCase() !== parsed.data.confirmationEmail) {
    return {
      ok: false as const,
      error: "The confirmation email does not match this account.",
    };
  }

  const admin = createAdminClient();
  try {
    await withActor(
      { id: user.id, role: currentAdminRole(user) ?? "admin" },
      async (tx) => {
        const deleted = await tx
          .delete(profiles)
          .where(
            and(
              eq(profiles.id, parsed.data.id),
              eq(profiles.isActive, false),
            ),
          )
          .returning({ id: profiles.id });
        if (deleted.length !== 1) {
          throw new Error("The account changed while deletion was in progress.");
        }

        const { error } = await admin.auth.admin.deleteUser(parsed.data.id, false);
        if (error) throw new Error(`Supabase Auth: ${error.message}`);
      },
    );
  } catch (error) {
    let current: unknown = error;
    let code: string | null = null;
    for (let depth = 0; depth < 4 && current; depth += 1) {
      if (typeof current !== "object") break;
      if ("code" in current) {
        code = String(current.code);
        break;
      }
      current = "cause" in current ? current.cause : null;
    }
    if (code === "23503") {
      return {
        ok: false as const,
        error:
          "This account has protected financial, teaching, or administrative records and cannot be hard-deleted safely. Keep it deactivated instead.",
      };
    }
    const safeMessage =
      error instanceof Error &&
      (error.message.startsWith("Supabase Auth:") ||
        error.message.startsWith("The account changed"))
        ? error.message
        : `Could not permanently delete ${target.firstName} ${target.lastName}.`;
    return { ok: false as const, error: safeMessage };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function sendPasswordReset(email: string) {
  const user = await requireAdmin();
  const parsedEmail = z.string().email().parse(email).trim().toLowerCase();
  const [target] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.email, parsedEmail))
    .limit(1);
  if (!target) return { ok: false as const, error: "User account not found." };
  if (!canAdminManageAccount(currentAdminRole(user), target.role)) {
    return {
      ok: false as const,
      error: "Only an owner-level admin can reset another admin’s password.",
    };
  }
  const admin = createAdminClient();
  try {
    const { error } = await admin.auth.resetPasswordForEmail(parsedEmail, {
      redirectTo: passwordSetupRedirect(),
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "The email provider could not be reached.",
    };
  }
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
