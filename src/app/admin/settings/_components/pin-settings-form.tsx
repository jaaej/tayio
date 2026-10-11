"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/admin/ui";
import { setAdminPin } from "@/app/admin/_lib/actions-security";

const PIN_INPUT = "h-[42px] rounded-[11px] text-[15px] tracking-[0.2em] placeholder:tracking-normal";

export function PinSettingsForm({ pinSet }: { pinSet: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-1.5"
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
      <div className="flex flex-wrap items-end gap-3.5">
        {pinSet && (
          <div className="flex min-w-[180px] flex-[1_1_200px] flex-col gap-1.5">
            <Label htmlFor="current" className="font-bold">
              Current PIN
            </Label>
            <Input
              id="current"
              name="current"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              className={PIN_INPUT}
            />
          </div>
        )}
        <div className="flex min-w-[180px] flex-[1_1_200px] flex-col gap-1.5">
          <Label htmlFor="next" className="font-bold">
            {pinSet ? "New PIN" : "Set a PIN"}
          </Label>
          <Input
            id="next"
            name="next"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            placeholder="6-8 digits"
            required
            className={PIN_INPUT}
          />
        </div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : pinSet ? "Change PIN" : "Set PIN"}
        </Button>
      </div>
      <div aria-live="polite">
        {ok && <span className="text-[12px] font-semibold text-good">Saved.</span>}
        {error && <span className="text-[12px] font-semibold text-bad">{error}</span>}
      </div>
    </form>
  );
}
