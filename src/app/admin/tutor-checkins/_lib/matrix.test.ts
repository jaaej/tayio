import { describe, expect, it } from "vitest";
import {
  buildMatrixRow,
  cellStatus,
  hoursLabel,
  rateLabel,
  rowStatus,
  weekDates,
  weekSummary,
  type MatrixEntry,
} from "./matrix";

const WEEK = "2026-10-05";

function entry(overrides: Partial<MatrixEntry> = {}): MatrixEntry {
  return {
    id: overrides.id ?? "e1",
    classId: "c1",
    workDate: "2026-10-05",
    minutes: 60,
    hourlyRate: "40.00",
    isRemoved: false,
    isManualOverride: false,
    ...overrides,
  };
}

describe("weekDates", () => {
  it("lists Monday to Sunday", () => {
    expect(weekDates(WEEK)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });
});

describe("cellStatus", () => {
  it("is empty without rows", () => {
    expect(cellStatus("pending", [])).toBeNull();
  });

  it("marks a day whose rows were all removed", () => {
    expect(cellStatus("approved", [entry({ isRemoved: true })])).toBe("removed");
  });

  it("follows the week status for paid rows", () => {
    expect(cellStatus("approved", [entry()])).toBe("approved");
    expect(cellStatus("disputed", [entry()])).toBe("issue");
    expect(cellStatus("pending", [entry()])).toBe("waiting");
  });

  it("flags an admin correction only while the week is pending", () => {
    const corrected = [entry({ isManualOverride: true })];
    expect(cellStatus("pending", corrected)).toBe("corrected");
    expect(cellStatus("approved", corrected)).toBe("approved");
    expect(cellStatus("disputed", corrected)).toBe("issue");
  });

  it("counts a removed correction on a day that still has paid rows", () => {
    expect(
      cellStatus("pending", [
        entry(),
        entry({ id: "e2", isRemoved: true, isManualOverride: true }),
      ]),
    ).toBe("corrected");
  });
});

describe("rowStatus", () => {
  it("is none when nothing is paid", () => {
    expect(rowStatus("approved", [])).toBe("none");
    expect(rowStatus("pending", [entry({ isRemoved: true })])).toBe("none");
  });

  it("maps the week status", () => {
    expect(rowStatus("approved", [entry()])).toBe("approved");
    expect(rowStatus("disputed", [entry()])).toBe("issue");
    expect(rowStatus("pending", [entry()])).toBe("waiting");
  });
});

describe("buildMatrixRow", () => {
  const entries = [
    entry({ id: "a", workDate: "2026-10-05", minutes: 60 }),
    entry({ id: "b", workDate: "2026-10-05", minutes: 90, classId: "c2" }),
    entry({ id: "c", workDate: "2026-10-08", minutes: 60, isRemoved: true }),
    entry({ id: "d", workDate: "2026-10-11", minutes: 45, hourlyRate: "45.00" }),
  ];

  it("groups rows into day cells and totals paid work", () => {
    const row = buildMatrixRow({ status: "pending", entries }, WEEK);
    expect(row.cells).toHaveLength(7);
    expect(row.cells[0]).toMatchObject({
      date: "2026-10-05",
      status: "waiting",
      minutes: 150,
      lessonCount: 2,
      entryIds: ["a", "b"],
    });
    expect(row.cells[1]).toMatchObject({ status: null, entryIds: [] });
    expect(row.cells[3]).toMatchObject({
      status: "removed",
      minutes: 0,
      lessonCount: 0,
      entryIds: ["c"],
    });
    expect(row.totalMinutes).toBe(195);
    expect(row.totalPay).toBe(40 + 60 + 33.75);
    expect(row.rates).toEqual([40, 45]);
    expect(row.hasMissingRate).toBe(false);
    expect(row.status).toBe("waiting");
    expect(row.entryIds).toEqual(["a", "b", "c", "d"]);
  });

  it("narrows every figure to the filtered class", () => {
    const row = buildMatrixRow({ status: "approved", entries }, WEEK, "c2");
    expect(row.entryIds).toEqual(["b"]);
    expect(row.totalMinutes).toBe(90);
    expect(row.totalPay).toBe(60);
    expect(row.cells[0].status).toBe("approved");
    expect(row.cells[6].status).toBeNull();
  });

  it("reports a missing rate on a paid row only", () => {
    const missing = buildMatrixRow(
      { status: "pending", entries: [entry({ hourlyRate: "0" })] },
      WEEK,
    );
    expect(missing.hasMissingRate).toBe(true);
    expect(missing.rates).toEqual([]);

    const removed = buildMatrixRow(
      {
        status: "pending",
        entries: [entry(), entry({ id: "z", hourlyRate: "0", isRemoved: true })],
      },
      WEEK,
    );
    expect(removed.hasMissingRate).toBe(false);
  });

  it("keeps totals equal to the sum of cent-rounded rows", () => {
    // 20 minutes at $33.33/hr is $11.11 per row.
    const row = buildMatrixRow(
      {
        status: "pending",
        entries: [
          entry({ id: "x", minutes: 20, hourlyRate: "33.33" }),
          entry({ id: "y", minutes: 20, hourlyRate: "33.33" }),
          entry({ id: "w", minutes: 20, hourlyRate: "33.33" }),
        ],
      },
      WEEK,
    );
    expect(row.totalPay).toBe(33.33);
  });
});

describe("weekSummary", () => {
  it("sums approved pay and counts rows waiting on the tutor", () => {
    expect(
      weekSummary([
        { status: "approved", totalPay: 100.1 },
        { status: "approved", totalPay: 0.2 },
        { status: "waiting", totalPay: 50 },
        { status: "issue", totalPay: 20 },
        { status: "none", totalPay: 0 },
      ]),
    ).toEqual({ approvedPay: 100.3, awaiting: 2 });
  });
});

describe("labels", () => {
  it("formats hours", () => {
    expect(hoursLabel(0)).toBe("0h");
    expect(hoursLabel(45)).toBe("45m");
    expect(hoursLabel(60)).toBe("1h");
    expect(hoursLabel(90)).toBe("1h 30m");
  });

  it("formats rates", () => {
    expect(rateLabel([], false)).toBeNull();
    expect(rateLabel([40], true)).toBe("Rate missing");
    expect(rateLabel([40], false)).toBe("$40/hr");
    expect(rateLabel([37.5, 45], false)).toBe("$37.50-$45/hr");
  });
});
