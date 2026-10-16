"use client";

import { useId } from "react";
import { SUBJECT_COLORS, subjectTone, type SubjectColor } from "@/lib/subject-tone";
import { yearLevelOptions } from "../_lib/year-levels";
import { SelectField } from "./class-fields";

/**
 * The ten subject colours as swatches (radio group): 28px squares, a ring on
 * the chosen one. Shared by New subject and the subject edit page.
 */
export function ColourSwatches({
  value,
  onChange,
  labelledBy,
}: {
  value: SubjectColor;
  onChange: (color: SubjectColor) => void;
  labelledBy: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="-m-[5px] flex flex-wrap">
      {SUBJECT_COLORS.map((key) => {
        const tone = subjectTone("", key);
        const on = key === value;
        return (
          <label key={key} title={tone.label} className="cursor-pointer rounded-[12px] p-[5px]">
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
              className="block h-7 w-7 rounded-[9px] transition-shadow duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[6px] peer-focus-visible:outline-brand-400"
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
