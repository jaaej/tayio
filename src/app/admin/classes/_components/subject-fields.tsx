"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { SUBJECT_COLORS, subjectTone, type SubjectColor } from "@/lib/subject-tone";
import { yearLevelOptions } from "../_lib/year-levels";
import { SelectField } from "./class-fields";

/**
 * The ten subject colours as swatches (radio group), a ring on the chosen
 * one: 28px in New subject, 24px in the edit page's subject row.
 */
export function ColourSwatches({
  value,
  onChange,
  labelledBy,
  size = "md",
}: {
  value: SubjectColor;
  onChange: (color: SubjectColor) => void;
  labelledBy: string;
  /** `sm` (24px) where the swatches share a row with other fields. */
  size?: "sm" | "md";
}) {
  const name = useId();
  const sm = size === "sm";
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={cn("flex flex-wrap", sm ? "-m-1" : "-m-[5px]")}>
      {SUBJECT_COLORS.map((key) => {
        const tone = subjectTone("", key);
        const on = key === value;
        return (
          <label key={key} title={tone.label} className={cn("cursor-pointer rounded-[12px]", sm ? "p-1" : "p-[5px]")}>
            <input
              type="radio"
              name={name}
              value={key}
              checked={on}
              onChange={() => onChange(key)}
              aria-label={tone.label}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "block transition-shadow duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[6px] peer-focus-visible:outline-brand-400",
                sm ? "h-6 w-6 rounded-[8px]" : "h-7 w-7 rounded-[9px]",
              )}
              style={{
                backgroundColor: tone.dot,
                boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 4px ${on ? "#17152B" : "transparent"}`,
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

/** Level as a select of the standard levels, keeping a custom saved one. */
export function LevelSelect({
  id,
  name,
  value,
  onChange,
  className,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <SelectField
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">No level</option>
      {yearLevelOptions(value).map((level) => (
        <option key={level} value={level}>
          {level}
        </option>
      ))}
    </SelectField>
  );
}
