import Link from "next/link";
import { AuthShell } from "../_components/auth-shell";

// Public signup is disabled at the application layer. Accounts are created
// by admin staff via scripts/seed-users.mjs or the admin portal. Belt-and-
// braces: the Supabase project also has email signups disabled in
// Authentication → Providers → Email.
//
// The old client-side SignupForm was removed on purpose: it called
// supabase.auth.signUp({ data: { role } }) from the browser, writing a
// caller-chosen role into user-mutable user_metadata - a self-service
// privilege-escalation path. Any future self-service signup MUST set role
// server-side into app_metadata only (never trust a client-supplied role).

export default function SignupPage() {
  return (
    <AuthShell
      title="Invite only"
      intro="New Taiyo accounts are created by our admin team. If you're a new student, parent or tutor, ask your Taiyo admin and we'll set you up."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="rounded-[6px] font-extrabold text-[#2c4a86] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c4a86]/40">
            Sign in
          </Link>
        </span>
      }
    />
  );
}
