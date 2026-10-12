"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  PROFILE_AVATAR_OPTIONS,
  type ProfileAvatarKey,
} from "@/lib/profile-avatars";
import { cn } from "@/lib/utils";

type AvatarUpdateResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Profile icon grid shared by the student and tutor profile pages: compact
 * square tiles that preview each icon exactly as it shows beside a name,
 * with the chosen one outlined in ink and ticked.
 */
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
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function choose(key: ProfileAvatarKey) {
    setMessage(null);
    start(async () => {
      try {
        const result = await updateAction(key);
        if (!result.ok) {
          setMessage({ text: result.error, ok: false });
          return;
        }
        setSelected(key);
        setMessage({ text: "Profile icon updated.", ok: true });
      } catch {
        setMessage({ text: "Could not update your icon. Try again.", ok: false });
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2.5">
        {PROFILE_AVATAR_OPTIONS.map((option) => {
          const active = selected === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={pending}
              onClick={() => choose(option.key)}
              aria-pressed={active}
              aria-label={option.label}
              title={option.label}
              className={cn(
                "relative grid aspect-square place-items-center rounded-[16px] border-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 disabled:cursor-wait",
                active
                  ? "border-ink bg-surface"
                  : "border-transparent bg-surface-2 hover:bg-surface-3",
              )}
            >
              <span aria-hidden>
                <ProfileAvatar avatarKey={option.key} fallback={initials} className="h-10 w-10" />
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-ink text-white"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={cn("mt-3 text-[12px] font-semibold", message.ok ? "text-good" : "text-bad")}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
