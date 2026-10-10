import { describe, expect, it } from "vitest";
import { isNavItemActive } from "./nav-active";

describe("isNavItemActive", () => {
  it("matches a portal root only on the exact path", () => {
    expect(isNavItemActive("/admin", "/admin")).toBe(true);
    expect(isNavItemActive("/admin/messages", "/admin")).toBe(false);
    expect(isNavItemActive("/tutor/messages/abc", "/tutor")).toBe(false);
  });

  it("keeps a destination active on its child routes", () => {
    expect(isNavItemActive("/admin/users", "/admin/users")).toBe(true);
    expect(isNavItemActive("/admin/users/123", "/admin/users")).toBe(true);
    expect(isNavItemActive("/student/messages/t1", "/student/messages")).toBe(true);
  });

  it("does not match a sibling route that shares a prefix", () => {
    expect(isNavItemActive("/admin/users-archive", "/admin/users")).toBe(false);
    expect(isNavItemActive("/tutor/classes", "/tutor/class")).toBe(false);
  });
});
