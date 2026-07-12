"use client";

import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/admin/ui";
import { updateUser } from "@/app/admin/_lib/actions-users";
import type { UserRole } from "@/db/schema";
import { ROLE_OPTIONS } from "@/lib/roles";
import { AdminPinPrompt } from "@/components/admin/pin-gate";

export function EditUserForm(props: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  yearLevel: string;
  school: string;
  role: UserRole;
  unlocked: boolean;
  pinSet: boolean;
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
              phone: String(fd.get("phone") || "") || null,
              yearLevel: String(fd.get("yearLevel") || "") || null,
              school: String(fd.get("school") || "") || null,
              role,
            });
            if (res.ok) setOk(true);
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
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lastName">Last name</Label>
        <Input
          id="lastName"
          name="lastName"
          defaultValue={props.lastName}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={props.phone} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <Select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          disabled={!props.unlocked}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        {!props.unlocked && (
          <div className="pt-1.5">
            <AdminPinPrompt pinSet={props.pinSet} label="Unlock to change role" />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="yearLevel">Year level</Label>
        <Input id="yearLevel" name="yearLevel" defaultValue={props.yearLevel} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="school">School</Label>
        <Input id="school" name="school" defaultValue={props.school} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {ok && (
          <span className="text-[12px] font-semibold text-good">Saved.</span>
        )}
        {error && (
          <span className="text-[12px] font-semibold text-bad">{error}</span>
        )}
      </div>
    </form>
  );
}
