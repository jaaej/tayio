import "server-only";

/**
 * Server-side upload validation.
 *
 * The client controls `File.type` (the declared MIME) and `File.name` (hence
 * the extension). Neither can be trusted: a client can label an HTML file as
 * `application/pdf`, or name an executable `worksheet.pdf`. We therefore:
 *
 *   1. cap the size,
 *   2. require the *declared* MIME to be in an allowlist,
 *   3. sniff the leading bytes and require the real content family to match
 *      what the declared MIME implies,
 *   4. return a *canonical* extension + content-type derived from the
 *      allowlist entry - never from the client filename.
 *
 * Residual limitation (accepted): OOXML (.docx/.pptx) and legacy Office
 * (.doc/.ppt) share ZIP / OLE container signatures, so we verify the container
 * family but not the specific Office subtype. Distinguishing them would require
 * parsing the container. For semi-trusted staff uploads this bar is sufficient;
 * the size cap bounds zip-bomb exposure and nothing is decompressed server-side.
 */

/** Content families we can distinguish by magic bytes. */
type Family =
  | "pdf"
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "zip" // OOXML: .docx / .pptx / .xlsx
  | "ole" // legacy Office: .doc / .ppt / .xls
  | "mp4" // ISO base media: .mp4 / .mov
  | "webm"
  | "text"; // no signature - validated as UTF-8 text instead

type AllowEntry = { family: Family; ext: string; mime: string };

export type UploadPolicy = {
  maxBytes: number;
  /**
   * Optional per-family size cap in bytes. When set, a file whose resolved
   * family exceeds the cap is rejected even if it is under `maxBytes`.
   * Keyed by Family value (e.g. "pdf", "zip", "mp4").
   */
  perFamilyMax?: Record<string, number>;
  /** Keyed by lowercased declared MIME. */
  allowed: Record<string, AllowEntry>;
};

export type ValidatedUpload = {
  ext: string;
  contentType: string;
};

export type ValidateResult =
  | { ok: true; file: ValidatedUpload }
  | { ok: false; error: string };

function matches(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

/** Detect the binary content family from leading bytes, or null if unknown. */
function sniff(b: Uint8Array): Family | null {
  if (matches(b, 0, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (matches(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (matches(b, 0, [0xff, 0xd8, 0xff])) return "jpeg";
  if (matches(b, 0, [0x47, 0x49, 0x46, 0x38])) return "gif"; // GIF8
  if (matches(b, 0, [0x52, 0x49, 0x46, 0x46]) && matches(b, 8, [0x57, 0x45, 0x42, 0x50]))
    return "webp"; // RIFF....WEBP
  if (matches(b, 0, [0x50, 0x4b, 0x03, 0x04])) return "zip"; // PK.. (OOXML)
  if (matches(b, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  if (matches(b, 4, [0x66, 0x74, 0x79, 0x70])) return "mp4"; // ....ftyp (mp4/mov)
  if (matches(b, 0, [0x1a, 0x45, 0xdf, 0xa3])) return "webm"; // EBML
  return null;
}

/** A NUL byte means binary; fatal UTF-8 decode rejects invalid sequences. */
function isUtf8Text(b: Uint8Array): boolean {
  if (b.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(b);
    return true;
  } catch {
    return false;
  }
}

export async function validateUpload(
  file: File,
  policy: UploadPolicy,
): Promise<ValidateResult> {
  if (file.size === 0) return { ok: false, error: "Empty file" };
  if (file.size > policy.maxBytes) {
    return {
      ok: false,
      error: `File exceeds max size (${Math.round(policy.maxBytes / (1024 * 1024))} MB)`,
    };
  }

  const declared = file.type.toLowerCase().split(";")[0].trim();
  const entry = policy.allowed[declared];
  if (!entry) {
    return { ok: false, error: `Unsupported file type: ${file.type || "unknown"}` };
  }

  const familyCap = policy.perFamilyMax?.[entry.family];
  if (familyCap !== undefined && file.size > familyCap) {
    return {
      ok: false,
      error: `File exceeds the ${entry.ext.toUpperCase()} size limit (${Math.round(familyCap / (1024 * 1024))} MB)`,
    };
  }

  if (entry.family === "text") {
    // No binary signature to match; a text file is validated by reading it and
    // confirming it decodes as UTF-8 with no NUL bytes, and doesn't actually
    // carry a known binary signature. Text policies are size-capped low, so the
    // full read is bounded.
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (sniff(bytes) !== null || !isUtf8Text(bytes)) {
      return { ok: false, error: "File content does not match declared type" };
    }
  } else {
    // Only the leading bytes are needed to identify a binary type - read a small
    // header slice and let the caller stream the original File to storage. This
    // avoids buffering large (e.g. 500 MB video) uploads into memory.
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (sniff(header) !== entry.family) {
      return { ok: false, error: "File content does not match declared type" };
    }
  }

  return { ok: true, file: { ext: entry.ext, contentType: entry.mime } };
}

// --- Policies ---------------------------------------------------------------

/** Documents + images: worksheets, homework attachments, tutor materials. */
const DOC_IMAGE_ALLOWED: Record<string, AllowEntry> = {
  "application/pdf": { family: "pdf", ext: "pdf", mime: "application/pdf" },
  "image/png": { family: "png", ext: "png", mime: "image/png" },
  "image/jpeg": { family: "jpeg", ext: "jpg", mime: "image/jpeg" },
  "image/jpg": { family: "jpeg", ext: "jpg", mime: "image/jpeg" },
  "image/gif": { family: "gif", ext: "gif", mime: "image/gif" },
  "image/webp": { family: "webp", ext: "webp", mime: "image/webp" },
  "application/msword": { family: "ole", ext: "doc", mime: "application/msword" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    family: "zip",
    ext: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  "application/vnd.ms-powerpoint": {
    family: "ole",
    ext: "ppt",
    mime: "application/vnd.ms-powerpoint",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    family: "zip",
    ext: "pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  "text/plain": { family: "text", ext: "txt", mime: "text/plain" },
};

export const ATTACHMENT_POLICY: UploadPolicy = {
  maxBytes: 25 * 1024 * 1024,
  allowed: DOC_IMAGE_ALLOWED,
};

/**
 * Quiz uploads travel through a 32 MB Server Action body.
 * Three files per batch at 10 MB each stay below that hard request cap.
 */
export const QUIZ_ATTACHMENT_POLICY: UploadPolicy = {
  maxBytes: 10 * 1024 * 1024,
  allowed: DOC_IMAGE_ALLOWED,
};

/** Homework attachments use the same allowlist as tutor attachments. */
export const HOMEWORK_POLICY: UploadPolicy = ATTACHMENT_POLICY;

export const VIDEO_POLICY: UploadPolicy = {
  maxBytes: 500 * 1024 * 1024,
  allowed: {
    "video/mp4": { family: "mp4", ext: "mp4", mime: "video/mp4" },
    "video/webm": { family: "webm", ext: "webm", mime: "video/webm" },
    "video/quicktime": { family: "mp4", ext: "mov", mime: "video/quicktime" },
  },
};

export const BOOKLET_POLICY: UploadPolicy = {
  maxBytes: 25 * 1024 * 1024,
  allowed: {
    "application/pdf": { family: "pdf", ext: "pdf", mime: "application/pdf" },
  },
};

/** Discussion board attachments: images + PDF only, up to 10 MB each. */
export const DISCUSSION_POLICY: UploadPolicy = {
  maxBytes: 10 * 1024 * 1024,
  allowed: {
    "application/pdf": { family: "pdf", ext: "pdf", mime: "application/pdf" },
    "image/png": { family: "png", ext: "png", mime: "image/png" },
    "image/jpeg": { family: "jpeg", ext: "jpg", mime: "image/jpeg" },
    "image/jpg": { family: "jpeg", ext: "jpg", mime: "image/jpeg" },
    "image/gif": { family: "gif", ext: "gif", mime: "image/gif" },
    "image/webp": { family: "webp", ext: "webp", mime: "image/webp" },
  },
};

/**
 * Resource library uploads: study docs, images, and video.
 * SVG is intentionally excluded - it executes script and is an XSS vector.
 * maxBytes is the overall ceiling (500 MB); perFamilyMax tightens document and
 * image families to 25 MB so a large video limit does not silently apply to PDFs.
 */
export const RESOURCE_POLICY: UploadPolicy = {
  maxBytes: 500 * 1024 * 1024, // 500 MB (video ceiling)
  perFamilyMax: {
    pdf: 25 * 1024 * 1024,
    png: 25 * 1024 * 1024,
    jpeg: 25 * 1024 * 1024,
    gif: 25 * 1024 * 1024,
    webp: 25 * 1024 * 1024,
    zip: 25 * 1024 * 1024, // OOXML: docx, pptx, xlsx
    mp4: 500 * 1024 * 1024, // mp4 and mov both resolve to "mp4" family
    webm: 500 * 1024 * 1024,
  },
  allowed: {
    "application/pdf": { family: "pdf", ext: "pdf", mime: "application/pdf" },
    "image/png": { family: "png", ext: "png", mime: "image/png" },
    "image/jpeg": { family: "jpeg", ext: "jpg", mime: "image/jpeg" },
    "image/jpg": { family: "jpeg", ext: "jpg", mime: "image/jpeg" },
    "image/gif": { family: "gif", ext: "gif", mime: "image/gif" },
    "image/webp": { family: "webp", ext: "webp", mime: "image/webp" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      family: "zip",
      ext: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      family: "zip",
      ext: "pptx",
      mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      family: "zip",
      ext: "xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    "video/mp4": { family: "mp4", ext: "mp4", mime: "video/mp4" },
    "video/quicktime": { family: "mp4", ext: "mov", mime: "video/quicktime" },
    "video/webm": { family: "webm", ext: "webm", mime: "video/webm" },
  },
};
