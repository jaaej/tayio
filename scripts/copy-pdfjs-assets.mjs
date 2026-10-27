// Copies the PDF renderer's worker, fonts, character maps and image decoders
// from pdfjs-dist into public/pdfjs, where the file viewer loads them
// (src/components/markup/pdf.ts). Runs before `next dev` and `next build`, so
// the copy always matches the installed pdfjs-dist; public/pdfjs is not
// committed.
//
// Usage: node scripts/copy-pdfjs-assets.mjs

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const from = path.join("node_modules", "pdfjs-dist");
const to = path.join("public", "pdfjs");
if (!existsSync(from)) {
  console.error("pdfjs-dist is not installed. Run npm install first.");
  process.exit(1);
}

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(path.join(from, "legacy", "build", "pdf.worker.min.mjs"), path.join(to, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "iccs"]) {
  cpSync(path.join(from, dir), path.join(to, dir), { recursive: true });
}
// Image decoders (JPEG 2000, JBIG2). PDF scripting (quickjs) stays off, so it is not copied.
cpSync(path.join(from, "wasm"), path.join(to, "wasm"), {
  recursive: true,
  filter: (source) => !path.basename(source).startsWith("quickjs"),
});
console.log("Copied pdf.js assets to public/pdfjs");
