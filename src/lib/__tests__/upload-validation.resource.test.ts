import { describe, it, expect } from "vitest";
import { validateUpload, RESOURCE_POLICY } from "../upload-validation";

const file = (bytes: Uint8Array, name: string, mime: string) =>
  new File([bytes as unknown as BlobPart], name, { type: mime });

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HTML = new TextEncoder().encode("<html><script>x</script></html>");
// MP4 magic: 4 bytes size + "ftyp" at offset 4
const MP4_HEADER = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);

const MB = 1024 * 1024;

function padded(header: Uint8Array, totalBytes: number): Uint8Array {
  const buf = new Uint8Array(totalBytes);
  buf.set(header);
  return buf;
}

describe("RESOURCE_POLICY", () => {
  it("accepts a real PDF declared as pdf", async () => {
    const r = await validateUpload(file(PDF, "paper.pdf", "application/pdf"), RESOURCE_POLICY);
    expect(r.ok).toBe(true);
  });
  it("accepts a real PNG", async () => {
    const r = await validateUpload(file(PNG, "diagram.png", "image/png"), RESOURCE_POLICY);
    expect(r.ok).toBe(true);
  });
  it("rejects HTML spoofed as PDF (magic-byte mismatch)", async () => {
    const r = await validateUpload(file(HTML, "evil.pdf", "application/pdf"), RESOURCE_POLICY);
    expect(r.ok).toBe(false);
  });
  it("rejects SVG (XSS vector) even if well-formed", async () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const r = await validateUpload(file(svg, "x.svg", "image/svg+xml"), RESOURCE_POLICY);
    expect(r.ok).toBe(false);
  });
  it("rejects an oversize file", async () => {
    const big = new Uint8Array(RESOURCE_POLICY.maxBytes + 1);
    big.set(PDF);
    const r = await validateUpload(file(big, "huge.pdf", "application/pdf"), RESOURCE_POLICY);
    expect(r.ok).toBe(false);
  });

  // Per-family cap tests: doc family capped at 25MB, video family at 500MB
  it("rejects a 26 MB PDF (doc family cap is 25 MB)", async () => {
    const big = padded(PDF, 26 * MB);
    const r = await validateUpload(file(big, "large.pdf", "application/pdf"), RESOURCE_POLICY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/size limit/i);
  });

  it("accepts a 26 MB MP4 (video family cap is 500 MB)", async () => {
    const big = padded(MP4_HEADER, 26 * MB);
    const r = await validateUpload(file(big, "lecture.mp4", "video/mp4"), RESOURCE_POLICY);
    expect(r.ok).toBe(true);
  });
});
