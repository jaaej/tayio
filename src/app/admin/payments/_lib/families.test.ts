import { describe, expect, it } from "vitest";
import {
  buildPaymentReminderBody,
  formatTotals,
  groupInvoicesByFamily,
  parseStatusFilter,
  paymentReminderDedupeKey,
  sumByCurrency,
  summariseByStatus,
  type FamilyInvoiceInput,
  type InvoiceStatus,
} from "./families";

function inv(over: Partial<FamilyInvoiceInput> = {}): FamilyInvoiceInput {
  return {
    id: "i1",
    parentId: "p1",
    parentName: "Pat Parent",
    parentEmail: "pat@example.com",
    studentName: "Sarah Student",
    amount: "320.00",
    currency: "AUD",
    status: "unpaid",
    dueDate: "2026-10-16",
    description: "Term 4",
    ...over,
  };
}

describe("parseStatusFilter", () => {
  it("accepts every fixed status and rejects anything else", () => {
    const all: InvoiceStatus[] = [
      "unpaid",
      "paid",
      "overdue",
      "partially_paid",
      "refunded",
      "cancelled",
    ];
    for (const s of all) expect(parseStatusFilter(s)).toBe(s);
    expect(parseStatusFilter(undefined)).toBeNull();
    expect(parseStatusFilter("partial")).toBeNull();
    expect(parseStatusFilter("")).toBeNull();
  });
});

describe("sumByCurrency / formatTotals", () => {
  it("sums in cents per currency", () => {
    expect(
      sumByCurrency([
        { amount: "0.10", currency: "AUD" },
        { amount: "0.20", currency: "aud" },
        { amount: "5", currency: "USD" },
      ]),
    ).toEqual([
      { currency: "AUD", amount: 0.3 },
      { currency: "USD", amount: 5 },
    ]);
  });

  it("drops cents on whole amounts and keeps them otherwise", () => {
    expect(formatTotals([{ currency: "AUD", amount: 640 }])).toBe("$640");
    expect(formatTotals([{ currency: "AUD", amount: 160.5 }])).toBe("$160.50");
    expect(formatTotals([])).toBe("$0");
  });

  it("joins several currencies", () => {
    expect(
      formatTotals([
        { currency: "AUD", amount: 10 },
        { currency: "USD", amount: 5 },
      ]),
    ).toMatch(/^\$10 \+ USD\s5$/);
  });
});

describe("groupInvoicesByFamily", () => {
  it("groups by billed parent and owes only open invoices", () => {
    const families = groupInvoicesByFamily(
      [
        inv({ id: "a", status: "overdue", dueDate: "2026-03-10" }),
        inv({ id: "b", status: "partially_paid", amount: "160.00" }),
        inv({ id: "c", status: "paid" }),
        inv({ id: "d", parentId: "p2", parentName: "Helen Brown", studentName: "Isla Brown" }),
      ],
      { status: null },
    );
    expect(families.map((f) => f.parentId)).toEqual(["p1", "p2"]);
    expect(families[0].invoices.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(families[0].owing).toEqual([{ currency: "AUD", amount: 480 }]);
    expect(families[0].openCount).toBe(2);
    expect(families[0].overdueCount).toBe(1);
  });

  it("filters invoices by status but keeps the family's full balance", () => {
    const families = groupInvoicesByFamily(
      [
        inv({ id: "a", status: "overdue" }),
        inv({ id: "b", status: "unpaid" }),
        inv({ id: "c", parentId: "p2", parentName: "Helen", status: "paid" }),
      ],
      { status: "overdue" },
    );
    expect(families).toHaveLength(1);
    expect(families[0].invoices.map((i) => i.id)).toEqual(["a"]);
    expect(families[0].owing).toEqual([{ currency: "AUD", amount: 640 }]);
  });

  it("lists linked children and invoice children once each", () => {
    const families = groupInvoicesByFamily(
      [inv({ studentName: "Sarah Student" }), inv({ id: "b", studentName: null })],
      {
        status: null,
        childrenByParent: new Map([["p1", ["sarah student", "Tom Student"]]]),
      },
    );
    expect(families[0].children).toEqual(["sarah student", "Tom Student"]);
  });

  it("searches parent name, email and children", () => {
    const rows = [
      inv(),
      inv({ id: "b", parentId: "p2", parentName: "Helen Brown", parentEmail: "h@x.com", studentName: "Isla Brown" }),
    ];
    const ids = (query: string) =>
      groupInvoicesByFamily(rows, { status: null, query }).map((f) => f.parentId);
    expect(ids("isla")).toEqual(["p2"]);
    expect(ids("PAT@")).toEqual(["p1"]);
    expect(ids("  ")).toEqual(["p2", "p1"]);
    expect(ids("nobody")).toEqual([]);
  });

  it("puts overdue families first, then the largest balance, then name", () => {
    const families = groupInvoicesByFamily(
      [
        inv({ id: "a", parentId: "p1", parentName: "Zed", amount: "900", status: "unpaid" }),
        inv({ id: "b", parentId: "p2", parentName: "Amy", amount: "10", status: "overdue" }),
        inv({ id: "c", parentId: "p3", parentName: "Bea", amount: "50", status: "paid" }),
        inv({ id: "d", parentId: "p4", parentName: "Abe", amount: "50", status: "paid" }),
      ],
      { status: null },
    );
    expect(families.map((f) => f.parentName)).toEqual(["Amy", "Zed", "Abe", "Bea"]);
  });
});

describe("summariseByStatus", () => {
  it("counts and totals every status", () => {
    const s = summariseByStatus([
      inv({ status: "overdue" }),
      inv({ status: "overdue", amount: "10.50" }),
      inv({ status: "paid" }),
    ]);
    expect(s.overdue).toEqual({ count: 2, totals: [{ currency: "AUD", amount: 330.5 }] });
    expect(s.paid.count).toBe(1);
    expect(s.refunded).toEqual({ count: 0, totals: [] });
  });
});

describe("payment reminder", () => {
  it("keys one reminder per family per day", () => {
    expect(paymentReminderDedupeKey("p1", "2026-10-11")).toBe(
      "payment-reminder:p1:2026-10-11",
    );
  });

  it("summarises the open balance for the parent", () => {
    expect(
      buildPaymentReminderBody([
        { amount: "320", currency: "AUD", status: "overdue" },
        { amount: "160", currency: "AUD", status: "partially_paid" },
      ]),
    ).toBe(
      "You have 2 invoices totalling $480 that are awaiting payment, including 1 overdue. Open Payments to see the details.",
    );
    expect(
      buildPaymentReminderBody([{ amount: "320", currency: "AUD", status: "unpaid" }]),
    ).toBe(
      "You have 1 invoice totalling $320 that is awaiting payment. Open Payments to see the details.",
    );
  });
});
