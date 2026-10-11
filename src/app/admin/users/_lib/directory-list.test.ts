import { describe, expect, it } from "vitest";
import {
  filterDirectory,
  groupDirectory,
  listQueryString,
  normaliseYearLevel,
  withListQuery,
  type DirectoryListItem,
} from "./directory-list";

function person(
  overrides: Partial<DirectoryListItem> & Pick<DirectoryListItem, "id" | "firstName">,
): DirectoryListItem {
  return {
    lastName: "Test",
    email: `${overrides.id}@example.com`,
    role: "student",
    status: "active",
    school: null,
    yearLevel: null,
    sub: "",
    flag: null,
    classInfo: [],
    ...overrides,
  };
}

describe("normaliseYearLevel", () => {
  it("puts every spelling of a numeric year in one group", () => {
    const spellings = ["10", "Year 10", "Yr 10", "yr10", "year  10", " Y10 ", "Grade 10"];
    const keys = new Set(spellings.map((s) => normaliseYearLevel(s).key));
    expect(keys.size).toBe(1);
    for (const s of spellings) expect(normaliseYearLevel(s).label).toBe("Year 10");
  });

  it("never doubles the prefix", () => {
    expect(normaliseYearLevel("Yr Year 10").label).toBe("Year 10");
    expect(normaliseYearLevel("Year 9").label).toBe("Year 9");
  });

  it("keeps named levels as typed but groups them case-insensitively", () => {
    expect(normaliseYearLevel("VCE").label).toBe("VCE");
    expect(normaliseYearLevel("vce").key).toBe(normaliseYearLevel("VCE").key);
  });

  it("treats blank values as unset", () => {
    expect(normaliseYearLevel(null).key).toBe("none");
    expect(normaliseYearLevel("   ").key).toBe("none");
  });
});

describe("groupDirectory", () => {
  const students = [
    person({ id: "a", firstName: "Ava", yearLevel: "Year 10" }),
    person({ id: "b", firstName: "Ben", yearLevel: "10" }),
    person({ id: "c", firstName: "Cal", yearLevel: "Yr 9" }),
    person({ id: "d", firstName: "Dee", yearLevel: "VCE" }),
    person({ id: "e", firstName: "Eve", yearLevel: null }),
  ];

  it("groups students by normalised year, youngest first", () => {
    const groups = groupDirectory(students, "student", "asc");
    expect(groups.map((g) => g.label)).toEqual([
      "Year 9",
      "Year 10",
      "VCE",
      "No year level",
    ]);
    expect(groups[1].people.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("applies the name sort inside each group", () => {
    const groups = groupDirectory(students, "student", "desc");
    expect(groups[1].people.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("groups everyone by role in centre order, skipping empty roles", () => {
    const groups = groupDirectory(
      [
        person({ id: "s", firstName: "Sam" }),
        person({ id: "t", firstName: "Tia", role: "tutor" }),
        person({ id: "m", firstName: "Max", role: "admin" }),
      ],
      null,
      "asc",
    );
    expect(groups.map((g) => g.label)).toEqual(["Admins", "Tutors", "Students"]);
  });

  it("groups a single non-student role by initial", () => {
    const groups = groupDirectory(
      [
        person({ id: "1", firstName: "Pat", role: "parent" }),
        person({ id: "2", firstName: "amy", role: "parent" }),
        person({ id: "3", firstName: "Phil", role: "parent" }),
      ],
      "parent",
      "asc",
    );
    expect(groups.map((g) => [g.label, g.people.length])).toEqual([
      ["A", 1],
      ["P", 2],
    ]);
  });
});

describe("filterDirectory", () => {
  const items = [
    person({ id: "a", firstName: "Ava", school: "North" }),
    person({ id: "b", firstName: "Ben", status: "discontinued" }),
    person({ id: "c", firstName: "Cal", role: "tutor" }),
  ];

  it("defaults to active people and narrows by role, school and search", () => {
    const base = { role: null, status: "active" as const, school: null, query: "" };
    expect(filterDirectory(items, base, new Set()).map((p) => p.id)).toEqual(["a", "c"]);
    expect(
      filterDirectory(items, { ...base, role: "tutor" }, new Set()).map((p) => p.id),
    ).toEqual(["c"]);
    expect(
      filterDirectory(items, { ...base, school: "North" }, new Set()).map((p) => p.id),
    ).toEqual(["a"]);
    expect(
      filterDirectory(items, { ...base, status: "all", query: "ben" }, new Set()).map(
        (p) => p.id,
      ),
    ).toEqual(["b"]);
  });
});

describe("list query helpers", () => {
  it("keeps only list params", () => {
    expect(
      listQueryString(new URLSearchParams("role=student&tab=credits&q=ava&new=1")),
    ).toBe("role=student&q=ava");
  });

  it("builds links that carry the list and extra params", () => {
    expect(withListQuery("/admin/users/1", { role: "tutor", month: "2026-10" })).toBe(
      "/admin/users/1?role=tutor",
    );
    expect(withListQuery("/admin/users/1", {}, { tab: "lessons" })).toBe(
      "/admin/users/1?tab=lessons",
    );
    expect(withListQuery("/admin/users", {})).toBe("/admin/users");
  });
});
