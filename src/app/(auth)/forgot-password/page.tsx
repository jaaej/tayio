import Link from "next/link";
import { AuthError } from "../_components/auth-fields";
import { AuthShell } from "../_components/auth-shell";
import { ForgotPasswordForm } from "./form";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell
      title="Forgot password"
      intro="Enter the email on your Taiyo account and we'll send you a link to set a new password."
      footer={
        <span>
          Remembered it?{" "}
          <Link href="/login" className="rounded-[6px] font-extrabold text-[#2c4a86] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c4a86]/40">
            Back to sign in
          </Link>
        </span>
      }
    >
      {error === "invalid_or_expired" && (
        <div className="mb-5">
          <AuthError>
            That password-reset link is invalid, expired, or has already been
            used. Request a new link below.
          </AuthError>
        </div>
      )}
      <ForgotPasswordForm />
    </AuthShell>
  );
}
