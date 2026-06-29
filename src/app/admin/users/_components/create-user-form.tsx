"use client";

import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/admin/ui";
import { createUser } from "@/app/admin/_lib/actions-users";

const ROLES = ["student", "parent", "tutor", "admin"] as const;

export function CreateUserForm() {
  const [pending, start] = useTransition();
  const [role, setRole] = useState<(typeof ROLES)[number]>("student");
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
        const form = e.currentTarget;
        start(async () => {
          const res = await createUser({
            email: String(fd.get("email") || ""),
            password: String(fd.get("password") || ""),
            role,
            firstName: String(fd.get("firstName") || ""),
            lastName: String(fd.get("lastName") || ""),
            phone: String(fd.get("phone") || "") || undefined,
            yearLevel: String(fd.get("yearLevel") || "") || undefined,
            school: String(fd.get("school") || "") || undefined,
          });
          if (!res.ok) setError(res.error);
          else {
            setOk(true);
            form.reset();
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="firstName">First name</Label>
        <Input id="firstName" name="firstName" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lastName">Last name</Label>
        <Input id="lastName" name="lastName" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Temporary password</Label>
        <Input
          id="password"
          name="password"
          type="text"
          minLength={6}
          required
          placeholder="Min 6 characters"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <Select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" />
      </div>
      {role === "student" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="yearLevel">Year level</Label>
            <Input id="yearLevel" name="yearLevel" placeholder="e.g. 10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="school">School</Label>
            <Input id="school" name="school" />
          </div>
        </>
      )}
      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
        {ok && (
          <span className="text-[12px] font-semibold text-good">
            Account created.
          </span>
        )}
        {error && (
          <span className="text-[12px] font-semibold text-bad">{error}</span>
        )}
      </div>
    </form>
  );
}
