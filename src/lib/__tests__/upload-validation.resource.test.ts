import { describe, it, expect } from "vitest";
import { validateUpload, RESOURCE_POLICY } from "../upload-validation";

const file = (bytes: Uint8Array, name: string, mime: string) =>
  new File([bytes as unknown as BlobPart], name, { type: mime });

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HTML = new TextEncoder().encode("<html><script>x</script></html>");

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
});
