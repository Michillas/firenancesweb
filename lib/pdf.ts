import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");
let pdfjs: Promise<PdfJs> | null = null;

// pdf.js is large and browser-only: load it on first use, never during server render.
export function getPdfJs(): Promise<PdfJs> {
  return (pdfjs ??= import("pdfjs-dist").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return mod;
  }));
}

export interface OpenedPdf {
  doc: PDFDocumentProxy;
  task: PDFDocumentLoadingTask;
  destroy: () => Promise<void>;
}

// Character maps / standard fonts / wasm decoders are copied to /public/pdfjs by scripts/sync-assets.mjs.
export async function openPdf(blob: Blob): Promise<OpenedPdf> {
  const lib = await getPdfJs();
  const task = lib.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  });
  const doc = await task.promise;
  return { doc, task, destroy: () => task.destroy() };
}

export async function extractPdfText(blob: Blob, maxPages = 300): Promise<string> {
  const pdf = await openPdf(blob);
  const pages = Math.min(pdf.doc.numPages, maxPages);
  const parts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) line += "\n";
      line += item.str + (item.hasEOL ? "\n" : " ");
      lastY = y;
    }
    parts.push(line.trim());
  }
  await pdf.destroy();
  return parts.join("\n\n");
}
