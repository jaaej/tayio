"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sign-in field look from the owner's mock: pale fill, soft border. */
export const AUTH_INPUT =
  "h-[58px] w-full rounded-[14px] border border-[#dce4f3] bg-[#f4f7fd] px-5 text-[16px] text-[#0b2152] transition-colors placeholder:text-[#8391ae] hover:border-[#c9d4ea] focus:border-[#2c4a86] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#2c4a86]/12";

/** The navy primary button under the fields. */
export const AUTH_BUTTON =
  "flex h-[58px] w-full items-center justify-center rounded-[14px] bg-[#0b2152] text-[16px] font-extrabold text-white shadow-[0_16px_30px_-14px_rgba(11,33,82,0.6)] transition-[background-color,transform] duration-150 hover:bg-[#13306e] active:translate-y-px disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2c4a86]/30";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string };

/**
 * A field whose label is read by screen readers and shown as the
 * placeholder, as in the mock: each screen has at most two fields of
 * different kinds, so the placeholder alone tells them apart.
 */
export function AuthField({ id, label, className, ...props }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input id={id} placeholder={label} className={cn(AUTH_INPUT, className)} {...props} />
    </div>
  );
}

/** A password field with a show/hide toggle. */
export function AuthPasswordField({ id, label, ...props }: Omit<FieldProps, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type={shown ? "text" : "password"}
        placeholder={label}
        className={cn(AUTH_INPUT, "pr-14")}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-[11px] text-[#5b6987] transition-colors hover:bg-[#e8eefa] hover:text-[#0b2152] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c4a86]/40"
      >
        {shown ? (
          <EyeOff className="h-5 w-5" strokeWidth={1.9} aria-hidden />
        ) : (
          <Eye className="h-5 w-5" strokeWidth={1.9} aria-hidden />
        )}
      </button>
    </div>
  );
}

/** Error line under a form. */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-[14px] text-red-700">
      {children}
    </p>
  );
}
