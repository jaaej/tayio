import { getStroke } from "perfect-freehand";
import { PAGE_UNITS, type InkItem, type MarkupItem, type TextItem, textHeight } from "./doc";

/*
 * Shapes and positions shared by the viewer and the PDF writer: a stroke's
 * outline, where a page-unit point lands in a PDF page's own coordinates
 * (its crop box and rotation), and what a tap or the eraser touches.
 */

/** The outline of an ink mark as polygon points, the same in the browser and the PDF. */
export function inkOutline(item: Pick<InkItem, "kind" | "size" | "points">, complete = true): number[][] {
  const points: number[][] = [];
  for (let i = 0; i + 1 < item.points.length; i += 2) points.push([item.points[i], item.points[i + 1]]);
  return getStroke(points, {
    size: item.size,
    thinning: item.kind === "pen" ? 0.45 : 0,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: item.kind === "pen",
    last: complete,
  });
}

/** A closed SVG path through polygon points, smoothed with quadratic curves. */
export function outlinePath(outline: number[][]): string {
  if (outline.length === 0) return "";
  if (outline.length < 3) {
    const [x, y] = outline[0];
    return `M${fmt(x)} ${fmt(y)}Z`;
  }
  let d = `M${fmt(outline[0][0])} ${fmt(outline[0][1])}Q`;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += `${fmt(x0)} ${fmt(y0)} ${fmt((x0 + x1) / 2)} ${fmt((y0 + y1) / 2)} `;
  }
  return `${d.trimEnd()}Z`;
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export type PdfBox = { x: number; y: number; width: number; height: number };

/**
 * Maps page units (as the page is shown, top left origin) to PDF user space
 * for a page with this crop box and /Rotate. PDF viewers show a rotated page
 * turned clockwise, so the shown width is the box's height at 90 and 270.
 */
export function pageUnitsToPdf(box: PdfBox, rotation: number) {
  const r = (((rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const shownWidth = r === 90 || r === 270 ? box.height : box.width;
  const scale = shownWidth / PAGE_UNITS;
  const { width: w, height: h } = box;
  return {
    /** Points per page unit. */
    scale,
    /** Text runs left to right as shown: this many degrees anticlockwise in PDF space. */
    textRotation: r,
    point(u: number, v: number): [number, number] {
      const su = u * scale;
      const sv = v * scale;
      // (x, y) from the unrotated box's top left, y down.
      let x: number;
      let y: number;
      if (r === 90) {
        x = sv;
        y = h - su;
      } else if (r === 180) {
        x = w - su;
        y = h - sv;
      } else if (r === 270) {
        x = w - sv;
        y = su;
      } else {
        x = su;
        y = sv;
      }
      return [box.x + x, box.y + h - y];
    },
  };
}

/** How tall a page is in page units, from its shown size. */
export function pageHeightUnits(shownWidth: number, shownHeight: number): number {
  return (PAGE_UNITS * shownHeight) / shownWidth;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Does a circle at (x, y) of `radius` touch this ink mark? */
export function inkHit(item: Pick<InkItem, "size" | "points">, x: number, y: number, radius: number): boolean {
  const reach = item.size / 2 + radius;
  const p = item.points;
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= reach;
  for (let i = 0; i + 3 < p.length; i += 2) {
    if (distanceToSegment(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) return true;
  }
  return false;
}

/** Is (x, y) within `radius` of a text mark's box? `width` is its measured width in page units. */
export function textHit(item: Pick<TextItem, "x" | "y" | "size" | "text">, width: number, x: number, y: number, radius = 0): boolean {
  return (
    x >= item.x - radius &&
    x <= item.x + width + radius &&
    y >= item.y - radius &&
    y <= item.y + textHeight(item) + radius
  );
}

/** The marks on one page that a touch at (x, y) reaches, topmost first. */
export function hitItems(
  items: readonly MarkupItem[],
  pageIndex: number,
  x: number,
  y: number,
  radius: number,
  textWidth: (item: TextItem) => number,
): MarkupItem[] {
  return items
    .filter((item) =>
      item.page === pageIndex &&
      (item.kind === "text" ? textHit(item, textWidth(item), x, y, radius) : inkHit(item, x, y, radius)),
    )
    .reverse();
}
