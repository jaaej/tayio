"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { PROFILE_AVATAR_KEYS } from "@/lib/profile-avatars";
import { withActor } from "@/lib/with-actor";

const avatarSchema = z.enum(PROFILE_AVATAR_KEYS);

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Your new password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "The new passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Choose a new password that is different from your current one.",
    path: ["newPassword"],
  });

export type PasswordChangeState = {
  status?: "success" | "error";
  message?: string;
};

export async function changeMyPassword(
  _previous: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const user = await requireRole("student");
  const parsed = passwordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the password fields.",
    };
  }

  const allowed = await rateLimit({
    bucket: "student_password_change",
    identifier: user.id,
    max: 5,
    windowSeconds: 900,
  });
  if (!allowed) {
    return {
      status: "error",
      message: "Too many attempts. Please wait 15 minutes and try again.",
    };
  }
  if (!user.email) {
    return {
      status: "error",
      message: "This account has no email address. Ask an admin for help.",
    };
  }

  try {
    const supabase = await createClient();
    const { error: verificationError } =
      await supabase.auth.signInWithPassword({
        email: user.email,
        password: parsed.data.currentPassword,
      });
    if (verificationError) {
      return {
        status: "error",
        message: "Your current password is incorrect.",
      };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });
    if (updateError) {
      return {
        status: "error",
        message: "Your password could not be updated. Please try again.",
      };
    }

    return {
      status: "success",
      message: "Password updated successfully.",
    };
  } catch (error) {
    console.error("[student-profile] password change failed:", error);
    return {
      status: "error",
      message: "Your password could not be updated. Please try again.",
    };
  }
}

export async function setMyProfileAvatar(avatarKey: string) {
  const user = await requireRole("student");
  const parsed = avatarSchema.safeParse(avatarKey);
  if (!parsed.success) {
    return { ok: false as const, error: "Choose one of the available icons." };
  }

  await withActor({ id: user.id, role: "student" }, async (tx) => {
    await tx
      .update(profiles)
      .set({ profileAvatarKey: parsed.data, updatedAt: new Date() })
      .where(eq(profiles.id, user.id));
  });
  revalidatePath("/student", "layout");
  revalidatePath("/student/profile");
  revalidatePath("/tutor/students", "page");
  revalidatePath("/tutor/students/[id]", "page");
  return { ok: true as const };
}
