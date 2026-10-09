import { describe, expect, it } from "vitest";
import {
  PROFILE_PHOTO_POLICY,
  validateUpload,
} from "@/lib/upload-validation";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function file(bytes: Uint8Array, type: string) {
  return new File([bytes as unknown as BlobPart], "profile", { type });
}

describe("PROFILE_PHOTO_POLICY", () => {
  it("accepts a valid PNG", async () => {
    const result = await validateUpload(
      file(PNG, "image/png"),
      PROFILE_PHOTO_POLICY,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects SVG profile photos", async () => {
    const svg = new TextEncoder().encode(
      "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
    );
    const result = await validateUpload(
      file(svg, "image/svg+xml"),
      PROFILE_PHOTO_POLICY,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects files larger than 5 MB", async () => {
    const oversized = new Uint8Array(PROFILE_PHOTO_POLICY.maxBytes + 1);
    oversized.set(PNG);
    const result = await validateUpload(
      file(oversized, "image/png"),
      PROFILE_PHOTO_POLICY,
    );
    expect(result.ok).toBe(false);
  });
});
