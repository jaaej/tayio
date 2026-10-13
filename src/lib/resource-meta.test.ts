import { describe, expect, it } from "vitest";
import { resourceFormat, resourceMeta } from "./resource-meta";

describe("resourceFormat", () => {
  it("labels links as Link", () => {
    expect(resourceFormat({ kind: "link", storagePath: null, contentType: null })).toBe("Link");
  });

  it("uses the stored file's extension", () => {
    expect(
      resourceFormat({ kind: "file", storagePath: "abc/123/notes.final.pdf", contentType: null }),
    ).toBe("PDF");
    expect(
      resourceFormat({ kind: "file", storagePath: "a/Worksheet.docx", contentType: "application/pdf" }),
    ).toBe("DOCX");
  });

  it("falls back to the MIME type when the path has no usable extension", () => {
    expect(
      resourceFormat({ kind: "file", storagePath: "a/upload", contentType: "application/pdf" }),
    ).toBe("PDF");
    expect(
      resourceFormat({ kind: "file", storagePath: null, contentType: "image/png; charset=binary" }),
    ).toBe("PNG");
    expect(
      resourceFormat({
        kind: "file",
        storagePath: "a/.hidden",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe("DOCX");
  });

  it("returns null when nothing identifies the format", () => {
    expect(
      resourceFormat({ kind: "file", storagePath: "a/upload", contentType: "application/octet-stream" }),
    ).toBeNull();
    expect(resourceFormat({ kind: "file", storagePath: null, contentType: null })).toBeNull();
  });
});

describe("resourceMeta", () => {
  it("joins the format and the Melbourne day it was added", () => {
    // 14:30 UTC on 7 Oct is 1:30 am on 8 Oct in Melbourne (AEDT).
    expect(
      resourceMeta({
        kind: "file",
        storagePath: "a/b.pdf",
        contentType: null,
        createdAt: new Date("2026-10-07T14:30:00Z"),
      }),
    ).toBe("PDF · 8 Oct");
  });

  it("shows only the date when the format is unknown", () => {
    expect(
      resourceMeta({
        kind: "file",
        storagePath: null,
        contentType: null,
        createdAt: new Date("2026-09-28T02:00:00Z"),
      }),
    ).toBe("28 Sept");
  });
});
