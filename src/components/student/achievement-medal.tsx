import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Medal = "sun" | "mint" | "grape" | "sky" | "coral" | "brand";

const MEDAL_BG: Record<Medal, string> = {
  sun:   "bg-sun-100",
  mint:  "bg-mint-bg",
  grape: "bg-grape-bg",
  sky:   "bg-sky-bg",
  coral: "bg-coral-bg",
  brand: "bg-brand-50",
};

/**
 * Achievement medal - square tile with emoji + label, with locked variant.
 * Dummy/static data only until gamification backend exists.
 */
export function AchievementMedal({
  name,
  emoji,
  medal = "brand",
  earned,
}: {
  name: string;
  emoji: string;
  medal?: Medal;
  earned?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={cn(
          "w-full aspect-square rounded-[18px] grid place-items-center text-[24px] mb-1.5 transition-all",
          MEDAL_BG[medal],
          earned
            ? "shadow-[inset_0_0_0_2px_rgba(255,255,255,0.6)]"
            : "grayscale opacity-55",
        )}
      >
        {earned ? emoji : <Lock className="h-5 w-5 text-muted" />}
      </div>
      <div
        className={cn(
          "text-[10px] font-bold leading-tight",
          earned ? "text-ink-soft" : "text-muted-2",
        )}
      >
        {name}
      </div>
    </div>
  );
}
