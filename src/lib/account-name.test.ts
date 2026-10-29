import { describe, expect, it } from "vitest";
import { accountFirstName } from "./account-name";

describe("accountFirstName", () => {
  it("reads the admin-set name from app_metadata", () => {
    expect(
      accountFirstName(
        { email: "tutor@taiyo.com", app_metadata: { role: "tutor", first_name: "Tom" } },
        "Tutor",
      ),
    ).toBe("Tom");
  });

  it("prefers app_metadata over the user-editable user_metadata", () => {
    expect(
      accountFirstName(
        {
          email: "tutor@taiyo.com",
          app_metadata: { first_name: "Tom" },
          user_metadata: { first_name: "Tommy" },
        },
        "Tutor",
      ),
    ).toBe("Tom");
  });

  it("falls back to user_metadata for older accounts", () => {
    expect(
      accountFirstName({ email: "a@b.com", app_metadata: {}, user_metadata: { first_name: "Ann" } }, "x"),
    ).toBe("Ann");
  });

  it("skips blank names, then uses the email prefix, then the fallback", () => {
    expect(
      accountFirstName({ email: "sam.lee@example.com", app_metadata: { first_name: "  " } }, "x"),
    ).toBe("sam.lee");
    expect(accountFirstName({ email: null }, "there")).toBe("there");
  });
});
