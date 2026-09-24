"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  PROFILE_AVATAR_OPTIONS,
  type ProfileAvatarKey,
} from "@/lib/profile-avatars";

type AvatarUpdateResult =
  | { ok: true }
  | { ok: false; error: string };

export function ProfileIconPicker({
  current,
  initials,
  updateAction,
}: {
  current: string | null;
  initials: string;
  updateAction: (avatarKey: string) => Promise<AvatarUpdateResult>;
}) {
  const [selected, setSelected] = useState<string | null>(current);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function choose(key: ProfileAvatarKey) {
    setMessage(null);
    start(async () => {
      const result = await updateAction(key);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setSelected(key);
      setMessage("Profile icon updated.");
    });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {PROFILE_AVATAR_OPTIONS.map((option) => {
          const active = selected === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={pending}
              onClick={() => choose(option.key)}
              aria-pressed={active}
              className={`relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-[16px] border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                active
                  ? "border-brand-500 bg-brand-50 shadow-sm"
                  : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand-300 hover:bg-surface-2"
              }`}
            >
              <ProfileAvatar
                avatarKey={option.key}
                fallback={initials}
                className="h-16 w-16"
              />
              <span className="text-[12px] font-bold text-ink">
                {option.label}
              </span>
              {active ? (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {message ? (
        <p
          role="status"
          className={`mt-4 text-[12px] font-semibold ${message.includes("updated") ? "text-good" : "text-bad"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
