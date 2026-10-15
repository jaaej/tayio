import { AuthShell } from "../_components/auth-shell";
import { ResetPasswordForm } from "./form";

// This page is the landing target after the user clicks the reset-password
// email from Supabase. By the time they get here, the /auth/callback route
// has already exchanged the recovery token for a session, so the user is
// signed in and can call supabase.auth.updateUser({ password }).

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      intro="At least 8 characters. You'll be signed in as soon as you submit."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
