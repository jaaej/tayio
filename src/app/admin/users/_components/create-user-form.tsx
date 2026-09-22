"use client";

import { useId, useState, type ReactNode } from "react";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { UserRole } from "@/db/schema";
import { coarseRole, createUserRoleOptions } from "@/lib/roles";
import { cn } from "@/lib/utils";

export type LinkedParentValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  relationship?: string;
  password?: string;
  addressLine1?: string;
  addressLine2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
};

export type CreateUserValues = {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  yearLevel?: string;
  school?: string;
  phone?: string;
  password?: string;
  addressLine1?: string;
  addressLine2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  linkedParent?: LinkedParentValues;
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
  const [includeParent, setIncludeParent] = useState(false);

  // Reception (restricted admin) cannot create admin or tutor accounts, so the
  // form never offers those roles. The server re-checks this regardless.
  const roleOptions = createUserRoleOptions(canManagePrivilegedRoles);
  const isStudent = coarseRole(role) === "student";

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const text = (key: string) => String(fd.get(key) ?? "").trim();
        const linkedParent =
          isStudent && includeParent
            ? {
                firstName: text("parentFirstName"),
                lastName: text("parentLastName"),
                email: text("parentEmail"),
                phone: text("parentPhone") || undefined,
                relationship: text("parentRelationship") || "Parent",
                password: text("parentPassword") || undefined,
                addressLine1: text("parentAddressLine1") || undefined,
                addressLine2: text("parentAddressLine2") || undefined,
                suburb: text("parentSuburb") || undefined,
                state: text("parentState") || undefined,
                postcode: text("parentPostcode") || undefined,
              }
            : undefined;
        onSubmit({
          firstName: text("firstName"),
          lastName: text("lastName"),
          email: text("email"),
          role,
          yearLevel: text("yearLevel") || undefined,
          school: text("school") || undefined,
          phone: text("phone") || undefined,
          password: text("password") || undefined,
          addressLine1: text("addressLine1") || undefined,
          addressLine2: text("addressLine2") || undefined,
          suburb: text("suburb") || undefined,
          state: text("state") || undefined,
          postcode: text("postcode") || undefined,
          linkedParent,
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

        <Field id="phone" label="Phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="04XX XXX XXX"
            autoComplete="tel"
          />
        </Field>

        <PostalAddressFields />

        <RoleRadioGroup
          options={roleOptions}
          value={role}
          onChange={(nextRole) => {
            setRole(nextRole);
            if (coarseRole(nextRole) !== "student") setIncludeParent(false);
          }}
        />

        {isStudent && (
          <div className="grid grid-cols-2 gap-3">
            <Field id="yearLevel" label="Year level">
              <Input id="yearLevel" name="yearLevel" placeholder="e.g. 10" />
            </Field>
            <Field id="school" label="School">
              <Input id="school" name="school" placeholder="Optional" />
            </Field>
          </div>
        )}

        <Field
          id="password"
          label={isStudent ? "Student temporary password" : "Temporary password"}
        >
          <Input
            id="password"
            name="password"
            type="text"
            minLength={8}
            placeholder="Auto-generated"
            autoComplete="off"
          />
        </Field>

        {isStudent && (
          <section className="rounded-[14px] border border-line-strong bg-surface-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-extrabold text-ink">
                    Linked parent account
                  </h3>
                  <span className="rounded-full bg-info-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-info">
                    Parent
                  </span>
                  <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                    Optional
                  </span>
                </div>
                <p className="mt-1 max-w-xl text-[12px] leading-5 text-ink-soft">
                  Create the parent or guardian at the same time and link them
                  as this student&apos;s primary contact.
                </p>
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[12px] font-bold text-ink">
                <input
                  type="checkbox"
                  checked={includeParent}
                  onChange={(event) => setIncludeParent(event.target.checked)}
                  className="h-4 w-4 accent-brand-500"
                />
                Add parent details
              </label>
            </div>

            {includeParent && (
              <div className="mt-4 space-y-4 border-t border-line pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field id="parentFirstName" label="Parent first name">
                    <Input
                      id="parentFirstName"
                      name="parentFirstName"
                      required
                      autoComplete="off"
                    />
                  </Field>
                  <Field id="parentLastName" label="Parent last name">
                    <Input
                      id="parentLastName"
                      name="parentLastName"
                      required
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <Field id="parentEmail" label="Parent email">
                  <Input
                    id="parentEmail"
                    name="parentEmail"
                    type="email"
                    required
                    autoComplete="off"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field id="parentPhone" label="Parent phone">
                    <Input
                      id="parentPhone"
                      name="parentPhone"
                      type="tel"
                      placeholder="04XX XXX XXX"
                      autoComplete="off"
                    />
                  </Field>
                  <Field id="parentRelationship" label="Relationship">
                    <Input
                      id="parentRelationship"
                      name="parentRelationship"
                      defaultValue="Parent"
                      placeholder="e.g. Parent or guardian"
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <PostalAddressFields prefix="parent" />

                <Field
                  id="parentPassword"
                  label="Parent temporary password"
                >
                  <Input
                    id="parentPassword"
                    name="parentPassword"
                    type="text"
                    minLength={8}
                    placeholder="Auto-generated"
                    autoComplete="off"
                  />
                </Field>
              </div>
            )}
          </section>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </form>
  );
}

const AUSTRALIAN_STATES = [
  "ACT",
  "NSW",
  "NT",
  "QLD",
  "SA",
  "TAS",
  "VIC",
  "WA",
] as const;

function PostalAddressFields({ prefix = "" }: { prefix?: "" | "parent" }) {
  const name = (field: string) =>
    prefix ? `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}` : field;
  const labelPrefix = prefix ? "Parent " : "";

  return (
    <section className="space-y-3 rounded-[12px] border border-line bg-surface-2 p-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-ink">
            {labelPrefix}postal address
          </h3>
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted">
            Optional
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-muted">
          Used by the office for account and mailing records. It can be added
          later if it is not available now.
        </p>
      </div>

      <Field id={name("addressLine1")} label="Street address">
        <Input
          id={name("addressLine1")}
          name={name("addressLine1")}
          maxLength={200}
          autoComplete={prefix ? "off" : "street-address"}
        />
      </Field>

      <Field id={name("addressLine2")} label="Address line 2">
        <Input
          id={name("addressLine2")}
          name={name("addressLine2")}
          maxLength={200}
          placeholder="Apartment, unit or building (if applicable)"
          autoComplete="off"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id={name("suburb")} label="Suburb / locality">
          <Input
            id={name("suburb")}
            name={name("suburb")}
            maxLength={100}
            autoComplete={prefix ? "off" : "address-level2"}
          />
        </Field>
        <Field id={name("state")} label="State / territory">
          <Select
            id={name("state")}
            name={name("state")}
            defaultValue=""
            autoComplete={prefix ? "off" : "address-level1"}
          >
            <option value="">Select state (optional)</option>
            {AUSTRALIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field id={name("postcode")} label="Postcode">
        <Input
          id={name("postcode")}
          name={name("postcode")}
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          placeholder="3000"
          autoComplete={prefix ? "off" : "postal-code"}
        />
      </Field>
    </section>
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
