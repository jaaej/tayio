import { describe, expect, it } from "vitest";
import { formatBytes, resourceDownloadName } from "./resource-format";

describe("formatBytes", () => {
  it("scales units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(420 * 1024)).toBe("420 KB");
    expect(formatBytes(1.4 * 1024 * 1024)).toBe("1.4 MB");
  });
});

describe("resourceDownloadName", () => {
  it("names the file after its title with the stored extension", () => {
    expect(
      resourceDownloadName({ title: "Fractions: Week 3", storagePath: "abc/9f.pdf", contentType: "application/pdf" }),
    ).toBe("Fractions Week 3.pdf");
  });

  it("falls back to the content type when the path has no extension", () => {
    expect(
      resourceDownloadName({
        title: "Essay plan",
        storagePath: "curriculum/9f",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe("Essay plan.docx");
  });

  it("does not repeat an extension the title already has, and never returns an empty name", () => {
    expect(resourceDownloadName({ title: "notes.PDF", storagePath: "a/b.pdf", contentType: null })).toBe("notes.PDF");
    expect(resourceDownloadName({ title: "///", storagePath: "a/b.png", contentType: null })).toBe("Resource.png");
  });
});
