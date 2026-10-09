import { describe, expect, it } from "vitest";
import { viewableFileKind } from "./file-viewer";

describe("viewableFileKind", () => {
  it("recognises a signed PDF URL by its storage path", () => {
    expect(
      viewableFileKind(
        "https://example.supabase.co/storage/v1/object/sign/homework/worksheet.pdf?token=secret",
      ),
    ).toBe("pdf");
  });

  it("recognises browser-viewable images", () => {
    expect(viewableFileKind("https://example.com/answer.WEBP?download=0")).toBe(
      "image",
    );
  });

  it("recognises uploaded videos", () => {
    expect(viewableFileKind("curriculum/week-introduction.mp4")).toBe("video");
  });

  it("uses the separate file fallback for Office documents", () => {
    expect(viewableFileKind("homework/worksheet.docx")).toBe("other");
  });
});
