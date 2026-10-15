import { Suspense } from "react";
import { CONTACT_PAGE_URL } from "@/lib/site-contact";
import { AuthShell } from "../_components/auth-shell";
import { LoginForm } from "./form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      footer={
        CONTACT_PAGE_URL ? (
          <>
            <span>Need an account?</span>
            <a
              href={CONTACT_PAGE_URL}
              className="inline-flex h-11 items-center rounded-[12px] bg-[#eef2fa] px-4 text-[14px] font-extrabold text-[#0b2152] transition-colors hover:bg-[#e2e9f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c4a86]/40"
            >
              Contact admin
            </a>
          </>
        ) : (
          <span>Need an account? Ask your Taiyo admin.</span>
        )
      }
    >
      <Suspense fallback={<div className="h-[260px]" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
