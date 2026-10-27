import { describe, expect, it } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream, degrees, type PDFPage } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { textBaselines, type MarkupDoc, type MarkupItem } from "./doc";
import { FlattenError, flattenMarkup } from "./flatten";

const pen: MarkupItem = { id: "p", kind: "pen", page: 0, color: "#1F2333", size: 4.5, points: [100, 100, 400, 100] };
const highlight: MarkupItem = {
  id: "h",
  kind: "highlighter",
  page: 0,
  color: "#FDE047",
  size: 22,
  points: [100, 100, 400, 100],
};
const note: MarkupItem = { id: "t", kind: "text", page: 1, color: "#DC2626", size: 22, x: 100, y: 300, text: "√2 ≈ 1.41\nπr² ✓" };

const doc = (items: MarkupItem[]): MarkupDoc => ({ v: 1, items });

/** Two 600 by 800 pages; the second is turned a quarter, so it shows 800 wide. */
async function worksheet(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]);
  pdf.addPage([600, 800]).setRotation(degrees(90));
  return pdf.save();
}

/** Every content stream on the page, decoded, in drawing order. */
function contentOf(page: PDFPage): string {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => page.doc.context.lookup(ref)) : [contents];
  return streams
    .map((stream) => (stream instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(stream).decode()) : ""))
    .join("\n");
}

/** A JPEG header pdf-lib can embed: no picture data, just its size and an EXIF orientation. */
function jpeg(width: number, height: number, orientation: number): Uint8Array {
  const tiff = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const sof = [0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0];
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff, ...exif,
    0xff, 0xc0, (sof.length + 2) >> 8, (sof.length + 2) & 0xff, ...sof,
    0xff, 0xda, 0x00, 0x02, 0xff, 0xd9,
  ]);
}

describe("flattenMarkup", () => {
  it("writes typed text where it was shown, on a rotated page, with every character", async () => {
    const out = await flattenMarkup(await worksheet(), "pdf", doc([pen, note]));
    const pdf = await getDocument({ data: out, disableFontFace: true }).promise;
    try {
      expect(pdf.numPages).toBe(2);
      const page = await pdf.getPage(2);
      const viewport = page.getViewport({ scale: 1 });
      expect([viewport.width, viewport.height]).toEqual([800, 600]);
      const unit = viewport.width / 1000;
      const { items } = await page.getTextContent();
      const lines = items.flatMap((item) => ("str" in item && item.str.trim() ? [item] : []));
      expect(lines.map((line) => line.str)).toEqual(["√2 ≈ 1.41", "πr² ✓"]);
      textBaselines(note).forEach((baseline, i) => {
        const [x, y] = viewport.convertToViewportPoint(lines[i].transform[4], lines[i].transform[5]);
        expect(x).toBeCloseTo(note.x * unit, 3);
        expect(y).toBeCloseTo(baseline * unit, 3);
      });
    } finally {
      await pdf.loadingTask.destroy();
    }
  });

  it("puts highlighter under the pen, as the viewer does, even when it was made after", async () => {
    const out = await flattenMarkup(await worksheet(), "pdf", doc([pen, highlight]));
    const content = contentOf((await PDFDocument.load(out)).getPage(0));
    // Fill colours, as pdf-lib writes them: #FDE047 and #1F2333.
    const yellow = content.search(/0\.99215\d* 0\.87843\d* 0\.27843\d* rg/);
    const ink = content.search(/0\.12156\d* 0\.13725\d* 0\.2 rg/);
    expect(yellow).toBeGreaterThan(-1);
    expect(ink).toBeGreaterThan(yellow);
  });

  it("leaves the font out when nothing was typed", async () => {
    const out = await flattenMarkup(await worksheet(), "pdf", doc([pen]));
    expect(new TextDecoder("latin1").decode(out)).not.toContain("/FontFile2");
  });

  it("stands a sideways phone photo upright on an A4-wide page", async () => {
    // Stored 400 by 300 with orientation 6: shown 300 wide and 400 tall.
    const out = await flattenMarkup(jpeg(400, 300, 6), "jpeg", doc([]));
    const page = (await PDFDocument.load(out)).getPage(0);
    expect(page.getWidth()).toBeCloseTo(595.28, 2);
    expect(page.getHeight()).toBeCloseTo((595.28 * 400) / 300, 2);
  });

  it("explains a locked or unreadable file", async () => {
    const plain = new TextDecoder("latin1").decode(
      await (await PDFDocument.create()).addPage().doc.save({ useObjectStreams: false }),
    );
    const locked = new Uint8Array([...plain.replace("/Root", "/Encrypt 1 0 R\n/Root")].map((c) => c.charCodeAt(0)));
    await expect(flattenMarkup(locked, "pdf", doc([]))).rejects.toThrow(/locked/);
    await expect(flattenMarkup(new Uint8Array([1, 2, 3]), "pdf", doc([]))).rejects.toThrow(FlattenError);
    await expect(flattenMarkup(new Uint8Array([1, 2, 3]), "png", doc([]))).rejects.toThrow(/picture could not be read/);
  });
});
