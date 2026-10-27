import { describe, expect, it } from "vitest";
import { SUBMISSION_POLICY, typeFromFileName, validateUpload } from "../upload-validation";

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
// An iPhone photo: an ISO media box whose brand is heic.
const HEIC = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63];
const DOCX = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00];
const HTML = [...new TextEncoder().encode("<html><script>")];

const blob = (bytes: number[], type: string) => new Blob([new Uint8Array([...bytes, ...new Array(32).fill(0x20)])], { type });

describe("SUBMISSION_POLICY", () => {
  it("takes the files a student hands in, with the extension their content proves", async () => {
    for (const [bytes, type, ext] of [
      [PDF, "application/pdf", "pdf"],
      [JPEG, "image/jpeg", "jpg"],
      [HEIC, "image/heic", "heic"],
      [DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
    ] as const) {
      const result = await validateUpload(blob(bytes, type), SUBMISSION_POLICY);
      expect(result).toEqual({ ok: true, file: expect.objectContaining({ ext }) });
    }
    const text = new Blob(["x = 4, so y = 2"], { type: "text/plain" });
    expect((await validateUpload(text, SUBMISSION_POLICY)).ok).toBe(true);
  });

  it("refuses a file whose content isn't what it claims", async () => {
    expect((await validateUpload(blob(HTML, "application/pdf"), SUBMISSION_POLICY)).ok).toBe(false);
    expect((await validateUpload(blob(HTML, "text/html"), SUBMISSION_POLICY)).ok).toBe(false);
  });
});

describe("typeFromFileName", () => {
  it("names the type for an extension the policy takes", () => {
    expect(typeFromFileName("my answers.DOCX", SUBMISSION_POLICY)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(typeFromFileName("IMG_0042.HEIC", SUBMISSION_POLICY)).toBe("image/heic");
    expect(typeFromFileName("photo.jpeg", SUBMISSION_POLICY)).toBe("image/jpeg");
  });

  it("gives nothing for other files, so they're still refused", () => {
    expect(typeFromFileName("page.html", SUBMISSION_POLICY)).toBeNull();
    expect(typeFromFileName("README", SUBMISSION_POLICY)).toBeNull();
  });

  it("still checks the content of an untyped file against its name", async () => {
    const named = (bytes: number[], name: string) => blob(bytes, typeFromFileName(name, SUBMISSION_POLICY) ?? "");
    expect((await validateUpload(named(DOCX, "answers.docx"), SUBMISSION_POLICY)).ok).toBe(true);
    expect((await validateUpload(named(HTML, "answers.docx"), SUBMISSION_POLICY)).ok).toBe(false);
  });
});
