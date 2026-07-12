"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/admin/ui";
import { setAdminPin } from "@/app/admin/_lib/actions-security";

export function PinSettingsForm({ pinSet }: { pinSet: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="max-w-sm space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        start(async () => {
          const res = await setAdminPin({
            current: pinSet ? String(fd.get("current") || "") : undefined,
            next: String(fd.get("next") || ""),
          });
          if (!res.ok) setError(res.error);
          else {
            setOk(true);
            form.reset();
            router.refresh();
          }
        });
      }}
    >
      {pinSet && (
        <div className="space-y-1.5">
          <Label htmlFor="current">Current PIN</Label>
          <Input id="current" name="current" type="password" inputMode="numeric" required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="next">{pinSet ? "New PIN" : "Set a PIN"}</Label>
        <Input
          id="next"
          name="next"
          type="password"
          inputMode="numeric"
          placeholder="6–8 digits"
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Saving…" : pinSet ? "Change PIN" : "Set PIN"}
        </Button>
        {ok && <span className="text-[12px] font-semibold text-good">Saved.</span>}
        {error && <span className="text-[12px] font-semibold text-bad">{error}</span>}
      </div>
    </form>
  );
}
