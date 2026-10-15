import { Suspense } from "react";
import { CONTACT_PAGE_URL } from "@/lib/site-contact";
import { AuthShell } from "../_components/auth-shell";
import { LoginForm } from "./form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome Back"
      footer={
        <>
          <span>Need an account? Ask your Taiyo admin.</span>
          <a
            href={CONTACT_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-[6px] font-extrabold text-[#2c4a86] underline underline-offset-4 hover:text-[#0b2152] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c4a86]/40"
          >
            Contact us on taiyotuition.com
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </>
      }
    >
      <Suspense fallback={<div className="h-[260px]" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
