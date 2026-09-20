import { describe, expect, it } from "vitest";
import { passwordSetupRedirect, siteOrigin } from "./site-url";

describe("siteOrigin", () => {
  it("uses an explicitly configured allow-listed origin", () => {
    expect(
      siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://test.example.com/path" }),
    ).toBe("https://test.example.com");
  });

  it("uses the client domain in production", () => {
    expect(siteOrigin({ VERCEL_ENV: "production" })).toBe(
      "https://portal.taiyotuition.com",
    );
  });

  it("uses the Vercel preview URL outside production", () => {
    expect(
      siteOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "preview.vercel.app",
        NODE_ENV: "production",
      }),
    ).toBe("https://preview.vercel.app");
  });

  it("defaults to localhost during local development", () => {
    expect(siteOrigin({ NODE_ENV: "development" })).toBe(
      "http://localhost:3000",
    );
  });
});

describe("passwordSetupRedirect", () => {
  it("routes recovery links through the existing code exchange", () => {
    expect(
      passwordSetupRedirect({ NEXT_PUBLIC_SITE_URL: "https://portal.example.com" }),
    ).toBe(
      "https://portal.example.com/auth/callback?next=/reset-password",
    );
  });
});
