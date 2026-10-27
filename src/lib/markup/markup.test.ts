import { describe, expect, it } from "vitest";
import {
  EMPTY_DOC,
  FONT_ASCENT,
  markupDocSchema,
  markupFileKind,
  readMarkupDoc,
  textBaselines,
} from "./doc";
import { hitItems, inkHit, inkOutline, outlinePath, pageUnitsToPdf } from "./geometry";
import {
  HISTORY_LIMIT,
  amendHistory,
  pushHistory,
  redoHistory,
  startHistory,
  undoHistory,
} from "./history";
import { jpegOrientation, orientationMatrix, orientationSwapsSides } from "./jpeg-orientation";

const pen = { id: "a", kind: "pen" as const, page: 0, color: "#1F2333", size: 4.5, points: [10, 10, 200, 10] };
const text = { id: "t", kind: "text" as const, page: 0, color: "#DC2626", size: 22, x: 100, y: 300, text: "√2 ≈ 1.41\nπr²" };

describe("markupDocSchema", () => {
  it("accepts the portal's own marks", () => {
    expect(markupDocSchema.safeParse({ v: 1, items: [pen, text] }).success).toBe(true);
  });

  it("refuses colours, sizes and shapes the viewer never makes", () => {
    const bad = [
      { ...pen, color: "#123456" },
      { ...pen, size: 50 },
      { ...pen, points: [1, 2, 3] },
      { ...pen, kind: "highlighter" },
      { ...text, size: 99 },
      { ...text, text: "x".repeat(1001) },
      { ...pen, extra: true },
      { ...pen, page: -1 },
    ];
    for (const item of bad) {
      expect(markupDocSchema.safeParse({ v: 1, items: [item] }).success).toBe(false);
    }
  });

  it("reads anything unreadable as an empty document", () => {
    expect(readMarkupDoc({ v: 2 })).toEqual(EMPTY_DOC);
    expect(readMarkupDoc(null)).toEqual(EMPTY_DOC);
  });
});

describe("markupFileKind", () => {
  it("writes on PDFs, PNGs and JPEGs only", () => {
    expect(markupFileKind("a/b.pdf")).toBe("pdf");
    expect(markupFileKind("a/b.JPG?token=1")).toBe("jpeg");
    expect(markupFileKind("a/3f2a", "image/png")).toBe("png");
    expect(markupFileKind("a/b.docx")).toBeNull();
    expect(markupFileKind("a/b.heic")).toBeNull();
    expect(markupFileKind("a/b.webp")).toBeNull();
  });
});

describe("textBaselines", () => {
  it("puts one baseline per line, a line height apart", () => {
    const [first, second] = textBaselines(text);
    expect(second - first).toBeCloseTo(22 * 1.25);
    expect(first).toBeGreaterThan(text.y);
    expect(first).toBeLessThan(text.y + 22 * 1.25);
    expect(first - text.y).toBeGreaterThan(FONT_ASCENT * 22 * 0.9);
  });
});

describe("pageUnitsToPdf", () => {
  const a4 = { x: 0, y: 0, width: 595, height: 842 };

  it("maps an upright page's top left and bottom right", () => {
    const t = pageUnitsToPdf(a4, 0);
    expect(t.point(0, 0)).toEqual([0, 842]);
    const [x, y] = t.point(1000, (1000 * 842) / 595);
    expect(x).toBeCloseTo(595);
    expect(y).toBeCloseTo(0);
  });

  it("follows the crop box", () => {
    const t = pageUnitsToPdf({ x: 50, y: 20, width: 500, height: 700 }, 0);
    expect(t.point(0, 0)).toEqual([50, 720]);
  });

  it("turns with a page rotated 90 degrees", () => {
    // Shown landscape: 842 wide, 595 tall. Shown top left is the box's top right... in PDF space (0, 0).
    const t = pageUnitsToPdf(a4, 90);
    expect(t.scale).toBeCloseTo(842 / 1000);
    const [x0, y0] = t.point(0, 0);
    expect(x0).toBeCloseTo(0);
    expect(y0).toBeCloseTo(0);
    const [x1, y1] = t.point(1000, 0);
    expect(x1).toBeCloseTo(0);
    expect(y1).toBeCloseTo(842);
    expect(t.textRotation).toBe(90);
  });

  it("turns with pages rotated 180 and 270 degrees", () => {
    const half = pageUnitsToPdf(a4, 180);
    expect(half.point(0, 0)).toEqual([595, 0]);
    const three = pageUnitsToPdf(a4, -90);
    expect(three.textRotation).toBe(270);
    const [x, y] = three.point(0, 0);
    expect(x).toBeCloseTo(595);
    expect(y).toBeCloseTo(842);
  });
});

describe("ink", () => {
  it("draws a closed outline", () => {
    const path = outlinePath(inkOutline(pen));
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });

  it("is hit near the line and missed away from it", () => {
    expect(inkHit(pen, 100, 12, 2)).toBe(true);
    expect(inkHit(pen, 100, 40, 2)).toBe(false);
    expect(inkHit({ size: 4, points: [5, 5] }, 6, 6, 1)).toBe(true);
  });

  it("finds marks on the touched page only, topmost first", () => {
    const other = { ...pen, id: "b" };
    const elsewhere = { ...pen, id: "c", page: 1 };
    const hits = hitItems([pen, other, elsewhere], 0, 100, 10, 3, () => 0);
    expect(hits.map((h) => h.id)).toEqual(["b", "a"]);
  });
});

describe("jpegOrientation", () => {
  function jpegWithOrientation(value: number, little = true): Uint8Array {
    const tiff = little
      ? [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, value, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
      : [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, value, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
    const length = exif.length + 2;
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff, ...exif, 0xff, 0xda, 0x00, 0x02]);
  }

  it("reads the orientation tag in either byte order", () => {
    expect(jpegOrientation(jpegWithOrientation(6))).toBe(6);
    expect(jpegOrientation(jpegWithOrientation(8, false))).toBe(8);
  });

  it("treats a JPEG without the tag, or a non-JPEG, as upright", () => {
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]))).toBe(1);
    expect(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1);
  });

  it("draws a sideways photo upright", () => {
    expect(orientationSwapsSides(6)).toBe(true);
    expect(orientationSwapsSides(3)).toBe(false);
    // Orientation 6: the stored top left corner (0, 1 in image space) shows at the top right.
    const [a, b, c, d, e, f] = orientationMatrix(6, 300, 400);
    expect([a * 0 + c * 1 + e, b * 0 + d * 1 + f]).toEqual([300, 400]);
    const [a8, b8, c8, d8, e8, f8] = orientationMatrix(8, 300, 400);
    expect([a8 * 0 + c8 * 1 + e8, b8 * 0 + d8 * 1 + f8]).toEqual([0, 0]);
  });
});

describe("history", () => {
  const one = [pen];
  const two = [pen, text];

  it("undoes and redoes steps in order", () => {
    let h = pushHistory(pushHistory(startHistory([]), one), two);
    h = undoHistory(h);
    expect(h.present).toBe(one);
    h = undoHistory(h);
    expect(h.present).toEqual([]);
    expect(undoHistory(h)).toBe(h);
    h = redoHistory(redoHistory(h));
    expect(h.present).toBe(two);
    expect(redoHistory(h)).toBe(h);
  });

  it("drops what could be redone once something new is drawn", () => {
    const h = pushHistory(undoHistory(pushHistory(startHistory([]), one)), two);
    expect(h.future).toEqual([]);
    expect(undoHistory(h).present).toEqual([]);
  });

  it("folds an eraser drag into one step", () => {
    let h = pushHistory(startHistory(two), one);
    h = amendHistory(h, []);
    expect(h.past).toEqual([two]);
    expect(undoHistory(h).present).toBe(two);
  });

  it("ignores a change that changed nothing", () => {
    const h = pushHistory(startHistory([]), one);
    expect(pushHistory(h, one)).toBe(h);
    expect(amendHistory(h, one)).toBe(h);
  });

  it("keeps the last HISTORY_LIMIT steps", () => {
    let h = startHistory([]);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = pushHistory(h, [{ ...pen, id: String(i) }]);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT; i++) h = undoHistory(h);
    expect(h.present[0].id).toBe("19");
    expect(undoHistory(h)).toBe(h);
  });
});
