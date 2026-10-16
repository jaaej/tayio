import { describe, expect, it } from "vitest";
import {
  SUBJECT_COLORS,
  defaultSubjectColor,
  isSubjectColor,
  subjectTone,
} from "./subject-tone";

describe("defaultSubjectColor", () => {
  it("picks a colour from the subject name when none is stored", () => {
    expect(defaultSubjectColor("Year 10 Maths")).toBe("teal");
    expect(defaultSubjectColor("VCE Maths Methods")).toBe("pink");
    expect(defaultSubjectColor("Year 11 Methods")).toBe("pink");
    expect(defaultSubjectColor("VCE Specialist Maths")).toBe("pink");
    expect(defaultSubjectColor("Year 9 English")).toBe("violet");
    expect(defaultSubjectColor("VCE Chemistry")).toBe("blue");
    expect(defaultSubjectColor("VCE Physics")).toBe("blue");
    expect(defaultSubjectColor("Japanese")).toBe("grey");
  });
});

describe("subjectTone", () => {
  it("uses the stored colour over the name", () => {
    expect(subjectTone("Year 10 Maths", "orange").color).toBe("orange");
  });

  it("falls back to the name when the stored colour is missing or unknown", () => {
    expect(subjectTone("Year 10 Maths", null).color).toBe("teal");
    expect(subjectTone("Year 10 Maths", undefined).color).toBe("teal");
    expect(subjectTone("Year 10 Maths", "magenta").color).toBe("teal");
  });

  it("knows only the palette keys", () => {
    expect(isSubjectColor("teal")).toBe(true);
    expect(isSubjectColor("magenta")).toBe(false);
    expect(isSubjectColor(null)).toBe(false);
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("palette contrast", () => {
  it.each(SUBJECT_COLORS)("%s: text pairs meet 4.5:1, the flat hero 3:1", (color) => {
    const tone = subjectTone("", color);
    expect(contrast(tone.fg, tone.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FFFFFF", tone.solid)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FFFFFF", tone.deep)).toBeGreaterThanOrEqual(4.5);
    // The flat fill carries large hero text only.
    expect(contrast("#FFFFFF", tone.flat)).toBeGreaterThanOrEqual(3);
  });

  it("gives every colour its own dot", () => {
    const dots = SUBJECT_COLORS.map((c) => subjectTone("", c).dot);
    expect(new Set(dots).size).toBe(SUBJECT_COLORS.length);
  });
});
