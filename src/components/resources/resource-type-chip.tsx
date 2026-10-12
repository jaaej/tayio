import { resourceTypeLabel, type ResourceTypeValue } from "@/lib/resource-types";
import { cn } from "@/lib/utils";

/*
 * Resource type as a tinted chip, shared by admin Resources and the tutor
 * library so a type reads the same colour everywhere. Related types share a
 * tint: practice material teal, reference notes lilac, exam material pink.
 */
const TONE: Record<ResourceTypeValue, string> = {
  worksheet: "bg-[#DDF3EE] text-[#0B5C4E]",
  answer_sheet: "bg-[#DDF3EE] text-[#0B5C4E]",
  notes: "bg-[#EEEBFD] text-[#3A1AA8]",
  formula_sheet: "bg-[#EEEBFD] text-[#3A1AA8]",
  past_paper: "bg-[#FBE8F1] text-[#9D2C61]",
  exam_guide: "bg-[#FBE8F1] text-[#9D2C61]",
  video: "bg-[#E7EFFD] text-[#1E4FB8]",
  writing_template: "bg-[#EEEFF6] text-[#2E2944]",
};

export function ResourceTypeChip({ type, className }: { type: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2 text-[11px] font-extrabold",
        TONE[type as ResourceTypeValue] ?? "bg-[#EEEFF6] text-[#2E2944]",
        className,
      )}
    >
      {resourceTypeLabel(type)}
    </span>
  );
}
