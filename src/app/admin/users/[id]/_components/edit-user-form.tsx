"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/admin/ui";
import { updateUser } from "@/app/admin/_lib/actions-users";
import type { UserRole } from "@/db/schema";
import { ROLE_OPTIONS } from "@/lib/roles";
import { coarseRole } from "@/lib/roles";

export function EditUserForm(props: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  suburb: string;
  state: string;
  postcode: string;
  yearLevel: string;
  school: string;
  role: UserRole;
  canManageRoles: boolean;
  canEditProfile: boolean;
}) {
  const [pending, start] = useTransition();
  const [role, setRole] = useState<UserRole>(props.role);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      className="grid sm:grid-cols-2 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            const res = await updateUser({
              id: props.id,
              firstName: String(fd.get("firstName") || ""),
              lastName: String(fd.get("lastName") || ""),
              email: String(fd.get("email") || ""),
              phone: String(fd.get("phone") || "") || null,
              addressLine1: String(fd.get("addressLine1") || "") || null,
              addressLine2: String(fd.get("addressLine2") || "") || null,
              suburb: String(fd.get("suburb") || "") || null,
              state: String(fd.get("state") || "") || null,
              postcode: String(fd.get("postcode") || "") || null,
              yearLevel: String(fd.get("yearLevel") || "") || null,
              school: String(fd.get("school") || "") || null,
              role,
            });
            if (res.ok) {
              setOk(true);
            } else {
              setError(res.error);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="firstName">First name</Label>
        <Input
          id="firstName"
          name="firstName"
          defaultValue={props.firstName}
          disabled={!props.canEditProfile}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lastName">Last name</Label>
        <Input
          id="lastName"
          name="lastName"
          defaultValue={props.lastName}
          disabled={!props.canEditProfile}
          required
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={props.email}
          disabled={!props.canEditProfile}
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={props.phone}
          disabled={!props.canEditProfile}
        />
      </div>
      <fieldset className="space-y-3 rounded-[12px] border border-line bg-surface-2 p-4 sm:col-span-2">
        <legend className="px-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
          Postal address
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="addressLine1">Street address</Label>
          <Input
            id="addressLine1"
            name="addressLine1"
            defaultValue={props.addressLine1}
            disabled={!props.canEditProfile}
            maxLength={200}
            autoComplete="street-address"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addressLine2">Address line 2</Label>
          <Input
            id="addressLine2"
            name="addressLine2"
            defaultValue={props.addressLine2}
            disabled={!props.canEditProfile}
            maxLength={200}
            placeholder="Apartment, unit or building"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="suburb">Suburb / locality</Label>
            <Input
              id="suburb"
              name="suburb"
              defaultValue={props.suburb}
              disabled={!props.canEditProfile}
              maxLength={100}
              autoComplete="address-level2"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State / territory</Label>
            <Select
              id="state"
              name="state"
              defaultValue={props.state}
              disabled={!props.canEditProfile}
              autoComplete="address-level1"
            >
              <option value="">Not provided</option>
              {AUSTRALIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              name="postcode"
              defaultValue={props.postcode}
              disabled={!props.canEditProfile}
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="postal-code"
            />
          </div>
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <Select
          id="role"
          name="role"
          value={role}
          disabled={!props.canManageRoles || !props.canEditProfile}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        {!props.canManageRoles && props.canEditProfile && (
          <p className="text-[11px] text-muted">
            Only an owner-level admin can change a user&apos;s role.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="yearLevel">Year level</Label>
        <Input
          id="yearLevel"
          name="yearLevel"
          defaultValue={props.yearLevel}
          disabled={!props.canEditProfile}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="school">School</Label>
        <Input
          id="school"
          name="school"
          defaultValue={props.school}
          disabled={!props.canEditProfile}
        />
      </div>
      {coarseRole(role) === "student" && (
        <div className="sm:col-span-2 rounded-[12px] border border-info/20 bg-info-bg px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          <div className="font-bold text-ink">Student break or holiday</div>
          Breaks use a start and end date. The student stays enrolled and their
          classes continue; tutors see that this student is away on affected
          rolls.
          <div className="mt-2">
            <Link
              href={`/admin/users/${props.id}?tab=lessons`}
              className="font-bold text-info hover:underline"
            >
              Manage dated student breaks →
            </Link>
          </div>
        </div>
      )}
      {coarseRole(role) === "tutor" && (
        <div className="sm:col-span-2 rounded-[12px] border border-warn/25 bg-warn-bg px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          <div className="font-bold text-ink">Tutor absence or leave</div>
          Tutor leave is not a profile toggle. The tutor submits a dated leave
          request; after admin approval, each affected lesson is placed on the
          cover board until a replacement accepts it.
          <div className="mt-2">
            <Link
              href="/admin/reschedules#tutor-cover"
              className="font-bold text-warn hover:underline"
            >
              Open tutor leave and cover →
            </Link>
          </div>
        </div>
      )}
      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
        <Button
          type="submit"
          variant="brand"
          disabled={pending || !props.canEditProfile}
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {ok && (
          <span className="text-[12px] font-semibold text-good">Saved.</span>
        )}
        {error && (
          <span className="text-[12px] font-semibold text-bad">{error}</span>
        )}
        {!props.canEditProfile && (
          <span className="text-[12px] font-semibold text-muted">
            Only an owner-level admin can edit another admin account.
          </span>
        )}
      </div>
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
