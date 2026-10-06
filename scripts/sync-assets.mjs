// Copies pdf.js runtime assets into /public so bank-statement PDFs can be read fully offline.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function sync(from, to, label) {
  const source = join(root, from);
  if (!existsSync(source)) return console.warn(`[assets] ${label} not found (${from})`);
  const target = join(root, to);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`[assets] ${label} synced`);
}

sync("node_modules/pdfjs-dist/cmaps", "public/pdfjs/cmaps", "pdf.js cmaps");
sync("node_modules/pdfjs-dist/standard_fonts", "public/pdfjs/standard_fonts", "pdf.js standard fonts");
sync("node_modules/pdfjs-dist/wasm", "public/pdfjs/wasm", "pdf.js wasm");
