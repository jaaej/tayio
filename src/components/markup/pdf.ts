"use client";

import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

/*
 * pdf.js, loaded only when a file is opened for writing on. The legacy build
 * runs on older iPads; its worker, fonts and image decoders are served from
 * public/pdfjs (scripts/copy-pdfjs-assets.mjs). WebAssembly stays off so the
 * page needs no 'wasm-unsafe-eval' in its content security policy; the
 * decoders' plain JavaScript versions load instead.
 */

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let loading: Promise<PdfJs> | null = null;

function pdfjs(): Promise<PdfJs> {
  loading ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker.min.mjs?v=${lib.version}`;
    return lib;
  });
  return loading;
}

export async function openPdf(url: string): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  return lib.getDocument({
    url,
    useWasm: false,
    wasmUrl: "/pdfjs/wasm/",
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    cMapUrl: "/pdfjs/cmaps/",
    iccUrl: "/pdfjs/iccs/",
    enableXfa: false,
  }).promise;
}

export type { PDFDocumentProxy };
