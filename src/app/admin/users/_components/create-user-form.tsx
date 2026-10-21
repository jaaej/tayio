"use client";

import { useId, useState, type ReactNode } from "react";
import { Input, Label } from "@/components/ui/input";
import type { UserRole } from "@/db/schema";
import { ROLE_OPTIONS, coarseRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

export type CreateUserValues = {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  yearLevel?: string;
  school?: string;
  phone?: string;
  password?: string;
};

/**
 * Body of the create-user slide-over. The submit button lives in the panel's
 * footer and reaches back in via `form={formId}`, so the panel owns the pending
 * / error / success state and this component stays a plain set of fields.
 */
export function CreateUserForm({
  formId,
  canManagePrivilegedRoles,
  disabled,
  error,
  onSubmit,
}: {
  formId: string;
  canManagePrivilegedRoles: boolean;
  disabled: boolean;
  error: string | null;
  onSubmit: (values: CreateUserValues) => void;
}) {
  const [role, setRole] = useState<UserRole>("student_restricted");

  // Reception (restricted admin) cannot create admin or tutor accounts, so the
  // form never offers those roles. The server re-checks this regardless.
  const roleOptions = canManagePrivilegedRoles
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter(
        (r) => coarseRole(r.value) !== "admin" && r.value !== "tutor",
      );

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const text = (key: string) => String(fd.get(key) ?? "").trim();
        onSubmit({
          firstName: text("firstName"),
          lastName: text("lastName"),
          email: text("email"),
          role,
          yearLevel: text("yearLevel") || undefined,
          school: text("school") || undefined,
          phone: text("phone") || undefined,
          password: text("password") || undefined,
        });
      }}
    >
      <fieldset disabled={disabled} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field id="firstName" label="First name">
            <Input id="firstName" name="firstName" required autoComplete="off" />
          </Field>
          <Field id="lastName" label="Last name">
            <Input id="lastName" name="lastName" required autoComplete="off" />
          </Field>
        </div>

        <Field id="email" label="Email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="off"
          />
        </Field>

        <RoleRadioGroup options={roleOptions} value={role} onChange={setRole} />

        {coarseRole(role) === "student" && (
          <div className="grid grid-cols-2 gap-3">
            <Field id="yearLevel" label="Year level">
              <Input id="yearLevel" name="yearLevel" placeholder="e.g. 10" />
            </Field>
            <Field id="school" label="School">
              <Input id="school" name="school" placeholder="Optional" />
            </Field>
          </div>
        )}

        <div className="border-t border-line pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-2">
            Optional
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field id="phone" label="Phone">
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="04xx xxx xxx"
                autoComplete="off"
              />
            </Field>
            <Field id="password" label="Temporary password">
              <Input
                id="password"
                name="password"
                type="text"
                minLength={8}
                placeholder="Auto-generated"
                autoComplete="off"
              />
            </Field>
          </div>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="block font-bold">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * Role picker as a pill group. Real `<input type="radio">`s sit behind the
 * pills, so arrow-key navigation, form semantics and screen-reader announcement
 * come from the browser rather than hand-rolled key handling.
 */
function RoleRadioGroup({
  options,
  value,
  onChange,
}: {
  options: { value: UserRole; label: string }[];
  value: UserRole;
  onChange: (role: UserRole) => void;
}) {
  const labelId = useId();

  return (
    <div>
      <span
        id={labelId}
        className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted"
      >
        Role
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="mt-2 flex flex-wrap gap-2"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[12px] font-bold transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-1",
              value === option.value
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-line-strong bg-surface text-ink hover:border-brand-500 hover:text-brand-700",
            )}
          >
            <input
              type="radio"
              name="role"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
