import { describe, expect, it } from "vitest";
import { officePreviewFits, officeViewerUrl, viewableFileKind } from "./file-viewer";

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

  it("recognises Word, PowerPoint and Excel files", () => {
    expect(viewableFileKind("homework/worksheet.docx")).toBe("office");
    expect(viewableFileKind("a/deck.PPTX?token=x")).toBe("office");
    expect(
      viewableFileKind("a/3f2a", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ).toBe("office");
    expect(viewableFileKind("a/notes.txt")).toBe("other");
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
    ).toBe("office");
  });
});

describe("officePreviewFits", () => {
  const MB = 1024 * 1024;
  it("allows Word and PowerPoint up to 10 MB and Excel up to 5 MB", () => {
    expect(officePreviewFits("a/b.docx", null, 10 * MB)).toBe(true);
    expect(officePreviewFits("a/b.docx", null, 10 * MB + 1)).toBe(false);
    expect(officePreviewFits("a/b.pptx", null, 9 * MB)).toBe(true);
    expect(officePreviewFits("a/b.xlsx", null, 6 * MB)).toBe(false);
  });
  it("reads the family from the content type when the path has no extension", () => {
    expect(officePreviewFits("a/3f2a", "application/vnd.ms-excel", 6 * MB)).toBe(false);
  });
  it("is false for anything that is not an Office file", () => {
    expect(officePreviewFits("a/b.pdf", "application/pdf", 1)).toBe(false);
  });
});

describe("officeViewerUrl", () => {
  it("passes the whole signed address, token included", () => {
    expect(officeViewerUrl("https://x.supabase.co/a/b.docx?token=t&x=1", "embed")).toBe(
      "https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fx.supabase.co%2Fa%2Fb.docx%3Ftoken%3Dt%26x%3D1",
    );
  });
});
