"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const tokenHashSchema = z.string().trim().min(20).max(2048);

export async function confirmPasswordRecovery(formData: FormData) {
  const parsed = tokenHashSchema.safeParse(formData.get("tokenHash"));
  if (!parsed.success) {
    redirect("/forgot-password?error=invalid_or_expired");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: parsed.data,
  });

  if (error) {
    redirect("/forgot-password?error=invalid_or_expired");
  }

  redirect("/reset-password");
}
