/*
 * A phone photo of a worksheet is often stored sideways with an EXIF
 * orientation tag; browsers turn it upright when showing it, so the marks are
 * made on the upright picture. The PDF writer has to turn it the same way.
 */

/** The EXIF orientation (1 to 8) of a JPEG, or 1 when it has none. */
export function jpegOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return 1;
    const marker = bytes[offset + 1];
    // Start of scan or end of image: no more metadata segments.
    if (marker === 0xda || marker === 0xd9) return 1;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return 1;
    if (marker === 0xe1) {
      const found = exifOrientation(bytes, offset + 4, offset + 2 + length);
      if (found) return found;
    }
    offset += 2 + length;
  }
  return 1;
}

function exifOrientation(bytes: Uint8Array, start: number, end: number): number | null {
  // "Exif\0\0"
  if (end - start < 14) return null;
  if (bytes[start] !== 0x45 || bytes[start + 1] !== 0x78 || bytes[start + 2] !== 0x69 || bytes[start + 3] !== 0x66) {
    return null;
  }
  const tiff = start + 6;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!little && !big) return null;
  const u16 = (at: number) => (little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1]);
  const u32 = (at: number) =>
    little
      ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
      : ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/** Orientations 5 to 8 swap the picture's width and height. */
export function orientationSwapsSides(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}

/**
 * The PDF matrix [a b c d e f] that draws the stored image (its unit square)
 * upright into a `width` by `height` area at the origin.
 */
export function orientationMatrix(
  orientation: number,
  width: number,
  height: number,
): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2:
      return [-width, 0, 0, height, width, 0];
    case 3:
      return [-width, 0, 0, -height, width, height];
    case 4:
      return [width, 0, 0, -height, 0, height];
    case 5:
      return [0, -height, -width, 0, width, height];
    case 6:
      return [0, -height, width, 0, 0, height];
    case 7:
      return [0, height, width, 0, 0, 0];
    case 8:
      return [0, height, -width, 0, width, 0];
    default:
      return [width, 0, 0, height, 0, 0];
  }
}
