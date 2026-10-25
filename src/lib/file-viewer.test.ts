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

  it("trusts a stored content type over a missing or wrong extension", () => {
    expect(viewableFileKind("curriculum/3f2a", "application/pdf")).toBe("pdf");
    expect(viewableFileKind("curriculum/3f2a", "image/jpeg")).toBe("image");
    expect(viewableFileKind("curriculum/3f2a", "video/quicktime")).toBe("video");
    expect(
      viewableFileKind(
        "curriculum/3f2a.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("other");
  });
});
