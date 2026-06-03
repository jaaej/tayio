import type { ReactNode } from "react";

/**
 * Encourage banner — soft brand-tinted strip with emoji + message.
 * Used on the dashboard below the quests list.
 */
export function EncourageBanner({
  emoji = "🚀",
  children,
}: {
  emoji?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 bg-brand-50 border border-brand-100 rounded-[14px] px-4 py-3.5">
      <span className="text-[26px] leading-none shrink-0">{emoji}</span>
      <div className="text-[13px] text-brand-ink font-semibold leading-snug">
        {children}
      </div>
    </div>
  );
}
