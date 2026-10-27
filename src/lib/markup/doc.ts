import { z } from "zod";

/*
 * Writing on a file: what a student or tutor draws, highlights and types on
 * a PDF or picture, stored apart from the file itself (`file_markups`). The
 * browser viewer and the server (which checks every save and draws the marks
 * into a PDF for "Submit this file") share these definitions, so a mark looks
 * the same in both.
 *
 * Coordinates are in page units: every page is PAGE_UNITS wide, whatever its
 * size on screen, and as tall as its shape makes it. Origin top left, as the
 * page is shown (a rotated PDF page is measured after its rotation).
 */

export const PAGE_UNITS = 1000;

export const PEN_COLORS = ["#1F2333", "#2563EB", "#DC2626", "#15803D"] as const;
export const HIGHLIGHT_COLORS = ["#FDE047", "#86EFAC", "#F9A8D4", "#93C5FD"] as const;

/** Pen diameters and text sizes in page units, small to large. */
export const PEN_SIZES = [2.5, 4.5, 8] as const;
export const TEXT_SIZES = [16, 22, 30] as const;
export const HIGHLIGHT_SIZE = 22;
/** Highlighter ink multiplies with the page, so text under it stays dark. */
export const HIGHLIGHT_OPACITY = 0.55;

/** Typed text: Taiyo Markup Sans (public/fonts/markup-sans.ttf, a subset of DejaVu Sans). */
export const MARKUP_FONT_FAMILY = "Taiyo Markup Sans";
export const TEXT_LINE_HEIGHT = 1.25;
/** The font's ascent and descent as a share of its size (hhea 1901 and 483 of 2048). */
export const FONT_ASCENT = 1901 / 2048;
export const FONT_DESCENT = 483 / 2048;

export const MAX_ITEMS = 3000;
export const MAX_STROKE_POINTS = 3000;
export const MAX_TEXT_LENGTH = 1000;
export const MAX_PAGES = 2000;
/** A saved document's JSON, in bytes; the save route refuses anything larger. */
export const MAX_DOC_BYTES = 2_000_000;

export type InkItem = {
  id: string;
  kind: "pen" | "highlighter";
  page: number;
  color: string;
  size: number;
  /** x0, y0, x1, y1, ... */
  points: number[];
};

export type TextItem = {
  id: string;
  kind: "text";
  page: number;
  color: string;
  size: number;
  /** Top left of the first line. */
  x: number;
  y: number;
  /** Lines break only where the writer pressed Enter, so the PDF wraps the same. */
  text: string;
};

export type MarkupItem = InkItem | TextItem;
export type MarkupDoc = { v: 1; items: MarkupItem[] };

export const EMPTY_DOC: MarkupDoc = { v: 1, items: [] };

/** Where each line of a text mark sits: its baseline, from the top of the page. */
export function textBaselines(item: Pick<TextItem, "y" | "size" | "text">): number[] {
  const lineHeight = item.size * TEXT_LINE_HEIGHT;
  const first = item.y + (lineHeight - (FONT_ASCENT + FONT_DESCENT) * item.size) / 2 + FONT_ASCENT * item.size;
  return item.text.split("\n").map((_, i) => first + i * lineHeight);
}

export function textHeight(item: Pick<TextItem, "size" | "text">): number {
  return item.text.split("\n").length * item.size * TEXT_LINE_HEIGHT;
}

const coord = z.number().finite().min(-200).max(40_000);
const id = z.string().min(1).max(40);
const page = z.number().int().min(0).max(MAX_PAGES - 1);

const inkSchema = z
  .object({
    id,
    kind: z.enum(["pen", "highlighter"]),
    page,
    color: z.string(),
    size: z.number(),
    points: z.array(coord).min(2).max(MAX_STROKE_POINTS * 2),
  })
  .strict()
  .refine((item) => item.points.length % 2 === 0, "Points come in x, y pairs")
  .refine(
    (item) =>
      item.kind === "pen"
        ? (PEN_COLORS as readonly string[]).includes(item.color) &&
          (PEN_SIZES as readonly number[]).includes(item.size)
        : (HIGHLIGHT_COLORS as readonly string[]).includes(item.color) && item.size === HIGHLIGHT_SIZE,
    "Use one of the portal's colours and sizes",
  );

const textSchema = z
  .object({
    id,
    kind: z.literal("text"),
    page,
    color: z.string(),
    size: z.number(),
    x: coord,
    y: coord,
    text: z.string().max(MAX_TEXT_LENGTH),
  })
  .strict()
  .refine(
    (item) =>
      (PEN_COLORS as readonly string[]).includes(item.color) &&
      (TEXT_SIZES as readonly number[]).includes(item.size),
    "Use one of the portal's colours and sizes",
  );

export const markupDocSchema = z
  .object({
    v: z.literal(1),
    items: z.array(z.union([inkSchema, textSchema])).max(MAX_ITEMS),
  })
  .strict();

/** A saved document, or EMPTY_DOC when what is stored no longer parses. */
export function readMarkupDoc(value: unknown): MarkupDoc {
  const parsed = markupDocSchema.safeParse(value);
  return parsed.success ? (parsed.data as MarkupDoc) : EMPTY_DOC;
}

/** What the viewer can write on: PDFs, and the pictures every browser and the PDF writer read. */
export type MarkupFileKind = "pdf" | "png" | "jpeg";

export function markupFileKind(
  path: string | null | undefined,
  contentType?: string | null,
): MarkupFileKind | null {
  const type = contentType?.split(";")[0].trim().toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  if (type === "image/jpeg" || type === "image/jpg") return "jpeg";
  const ext = path?.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  return null;
}
