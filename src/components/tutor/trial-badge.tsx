import { Pill } from "@/components/student/pill";
import { deriveTrialStatus } from "@/lib/trials";

/**
 * Free-trial status pill for tutor surfaces. Server-safe: `today` is computed
 * once by the calling server component and passed in, so status never drifts
 * with the client's clock or hydration timing. Renders nothing when the
 * student isn't on a trial enrollment.
 */
export function TrialBadge({
  trialStartsAt,
  trialEndsAt,
  today,
}: {
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  today: string;
}) {
  const status = deriveTrialStatus(trialStartsAt, trialEndsAt, today);

  if (status === "none") return null;

  if (status === "on_trial") {
    return <Pill tone="info">On trial</Pill>;
  }

  return <Pill tone="warn">Trial ended</Pill>;
}
