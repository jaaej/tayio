import { describe, expect, it } from "vitest";
import { subjectFamily, subjectTone } from "./subject-tone";

describe("subjectFamily", () => {
  it("groups subjects into the redesign's colour families", () => {
    expect(subjectFamily("Year 10 Maths")).toBe("maths");
    expect(subjectFamily("VCE Maths Methods")).toBe("senior");
    expect(subjectFamily("Year 11 Methods")).toBe("senior");
    expect(subjectFamily("VCE Specialist Maths")).toBe("senior");
    expect(subjectFamily("Year 9 English")).toBe("english");
    expect(subjectFamily("VCE Chemistry")).toBe("science");
    expect(subjectFamily("VCE Physics")).toBe("science");
    expect(subjectFamily("Japanese")).toBe("other");
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

describe("subjectTone contrast", () => {
  const names = ["Year 9 Maths", "Year 9 English", "VCE Physics", "VCE Maths Methods", "Japanese"];

  it.each(names)("%s: white on the solid fill and fg on the pale fill meet 4.5:1", (name) => {
    const tone = subjectTone(name);
    expect(contrast("#FFFFFF", tone.solid)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tone.fg, tone.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
