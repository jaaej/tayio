import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  BlendMode,
  PDFDocument,
  type PDFFont,
  type PDFPage,
  concatTransformationMatrix,
  degrees,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from "pdf-lib";
import { HIGHLIGHT_OPACITY, textBaselines, type MarkupDoc, type MarkupFileKind } from "./doc";
import { inkOutline, outlinePath, pageUnitsToPdf } from "./geometry";
import { jpegOrientation, orientationMatrix, orientationSwapsSides } from "./jpeg-orientation";

/*
 * "Submit this file": draws a student's marks into the file itself, so the
 * tutor gets one ordinary PDF they can open anywhere. The marks are drawn
 * with the same outlines and font metrics the viewer uses (geometry.ts,
 * doc.ts), so the PDF looks like what the student saw.
 */

/** A picture becomes one A4-wide page. */
const IMAGE_PAGE_WIDTH = 595.28;

const FONT_PATH = path.join(process.cwd(), "public", "fonts", "markup-sans.ttf");
let fontBytes: Promise<Buffer> | null = null;

export class FlattenError extends Error {}

export async function flattenMarkup(file: Uint8Array, kind: MarkupFileKind, doc: MarkupDoc): Promise<Uint8Array> {
  const pdf = kind === "pdf" ? await loadPdf(file) : await pictureAsPdf(file, kind);
  const pages = pdf.getPages();
  const needsFont = doc.items.some((item) => item.kind === "text" && item.text.trim() !== "");
  let font: PDFFont | null = null;
  if (needsFont) {
    pdf.registerFontkit(fontkit);
    fontBytes ??= readFile(FONT_PATH);
    // Whole, not subset: pdf-lib's subsetting drops glyphs from this font (π, ✓ and
    // everything after them vanished). The font is already cut down to about 220KB.
    font = await pdf.embedFont(await fontBytes, { subset: false });
  }

  // The viewer keeps highlighter under pen and text, whatever order they were made in.
  const layered = [
    ...doc.items.filter((item) => item.kind === "highlighter"),
    ...doc.items.filter((item) => item.kind !== "highlighter"),
  ];
  for (const [index, page] of pages.entries()) {
    const items = layered.filter((item) => item.page === index);
    if (items.length > 0) drawItems(page, items, font);
  }
  return pdf.save();
}

async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  let pdf: PDFDocument;
  try {
    // Opened even when locked and checked after: pdf-lib's EncryptedPDFError
    // fails `instanceof` (it is compiled to ES5), so the error can't tell us.
    pdf = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  } catch {
    throw new FlattenError("This PDF could not be read. Download it and upload your work instead.");
  }
  if (pdf.isEncrypted) {
    throw new FlattenError("This PDF is locked, so the portal can't write on it. Download it and upload your work instead.");
  }
  return pdf;
}

async function pictureAsPdf(bytes: Uint8Array, kind: "png" | "jpeg"): Promise<PDFDocument> {
  const pdf = await PDFDocument.create();
  let image;
  try {
    image = kind === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    throw new FlattenError("This picture could not be read. Download it and upload your work instead.");
  }
  // Browsers show a phone photo upright from its EXIF tag, and the marks were made on that.
  const orientation = kind === "jpeg" ? jpegOrientation(bytes) : 1;
  const [shownWidth, shownHeight] = orientationSwapsSides(orientation)
    ? [image.height, image.width]
    : [image.width, image.height];
  const width = IMAGE_PAGE_WIDTH;
  const height = (IMAGE_PAGE_WIDTH * shownHeight) / shownWidth;
  const page = pdf.addPage([width, height]);
  const name = page.node.newXObject("Image", image.ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...orientationMatrix(orientation, width, height)),
    drawObject(name),
    popGraphicsState(),
  );
  return pdf;
}

function drawItems(page: PDFPage, items: MarkupDoc["items"], font: PDFFont | null) {
  const angle = page.getRotation().angle;
  const map = pageUnitsToPdf(page.getCropBox(), angle % 90 === 0 ? angle : 0);
  const [originX, originY] = map.point(0, 0);
  const rotate = degrees(map.textRotation);

  for (const item of items) {
    const color = hexColor(item.color);
    if (item.kind === "text") {
      if (!font || item.text.trim() === "") continue;
      const lines = item.text.split("\n");
      textBaselines(item).forEach((baseline, i) => {
        if (lines[i] === "") return;
        const [x, y] = map.point(item.x, baseline);
        page.drawText(lines[i], { x, y, size: item.size * map.scale, font, color, rotate });
      });
      continue;
    }
    const d = outlinePath(inkOutline(item));
    if (!d) continue;
    page.drawSvgPath(d, {
      x: originX,
      y: originY,
      scale: map.scale,
      rotate,
      color,
      ...(item.kind === "highlighter" ? { opacity: HIGHLIGHT_OPACITY, blendMode: BlendMode.Multiply } : {}),
    });
  }
}

function hexColor(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
