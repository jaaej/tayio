"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Rate limit per IP (broad) and per email (tight) to blunt brute-forcing.
  const ip = await getClientIp();
  const [ipOk, emailOk] = await Promise.all([
    rateLimit({ bucket: "login_ip", identifier: ip, max: 20, windowSeconds: 300 }),
    rateLimit({ bucket: "login_email", identifier: email, max: 5, windowSeconds: 900 }),
  ]);
  if (!ipOk || !emailOk) {
    return {
      error: "Too many attempts. Please wait a few minutes and try again.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { error: error.message };
  }

  const role =
    (data.user?.app_metadata?.role as string | undefined) ??
    (data.user?.user_metadata?.role as string | undefined);

  // Open-redirect guard: allow only same-origin absolute paths. First char must
  // be "/" and the second must NOT be "/" or "\" — this rejects protocol-
  // relative ("//host") and backslash ("/\host") forms that browsers normalize
  // to another origin. Also reject any control characters (browsers strip
  // \t\r\n from URLs, which could smuggle a "//").
  const isSafeNext =
    /^\/[^/\\]/.test(next) && !/[\x00-\x1f\x7f]/.test(next);
  redirect((isSafeNext ? next : null) ?? (role ? `/${role}` : "/"));
}
