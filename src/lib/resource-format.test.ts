import { describe, expect, it } from "vitest";
import { formatBytes, resourceFormatLabel } from "./resource-format";

const file = { kind: "file", storagePath: null, contentType: null, externalUrl: null };

describe("resourceFormatLabel", () => {
  it("uses the stored extension", () => {
    expect(resourceFormatLabel({ ...file, storagePath: "a/b/notes.final.pdf" })).toBe("PDF");
  });
  it("falls back to a short MIME subtype", () => {
    expect(resourceFormatLabel({ ...file, storagePath: "a/b/upload", contentType: "image/png" })).toBe("PNG");
    expect(
      resourceFormatLabel({
        ...file,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBeNull();
  });
  it("shows a link's host", () => {
    expect(
      resourceFormatLabel({ ...file, kind: "link", externalUrl: "https://www.desmos.com/calculator" }),
    ).toBe("desmos.com");
    expect(resourceFormatLabel({ ...file, kind: "link", externalUrl: "not a url" })).toBe("Link");
  });
});

describe("formatBytes", () => {
  it("scales units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(420 * 1024)).toBe("420 KB");
    expect(formatBytes(1.4 * 1024 * 1024)).toBe("1.4 MB");
  });
});
