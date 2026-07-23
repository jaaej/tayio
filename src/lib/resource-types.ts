// Client-safe (no "server-only") label map for the resource_type enum
// (src/db/schema.ts resourceTypeEnum). Shared by the tutor resource-authoring
// form and the week/section-editor promote control so both selects render
// the same 8 options with the same wording.
export const RESOURCE_TYPES = [
  { value: "past_paper", label: "Past paper" },
  { value: "worksheet", label: "Worksheet" },
  { value: "answer_sheet", label: "Answer sheet" },
  { value: "notes", label: "Notes" },
  { value: "formula_sheet", label: "Formula sheet" },
  { value: "writing_template", label: "Writing template" },
  { value: "exam_guide", label: "Exam guide" },
  { value: "video", label: "Video" },
] as const;

export type ResourceTypeValue = (typeof RESOURCE_TYPES)[number]["value"];

const LABEL_BY_VALUE = new Map(RESOURCE_TYPES.map((t) => [t.value, t.label]));

export function resourceTypeLabel(type: string): string {
  return LABEL_BY_VALUE.get(type as ResourceTypeValue) ?? type;
}
