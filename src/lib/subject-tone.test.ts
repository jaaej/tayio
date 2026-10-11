import { describe, expect, it } from "vitest";
import { subjectFamily } from "./subject-tone";

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
