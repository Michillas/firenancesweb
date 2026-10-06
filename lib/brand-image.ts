import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Generated images (Open Graph, app icons) are rendered at build time outside the CSS theme, so they use the
// dark palette literally: keep in sync with `.dark` in app/globals.css.
export const BRAND = {
  background: "#070707",
  surface: "#111211",
  border: "#252625",
  foreground: "#f2f3f2",
  muted: "#8b8f8c",
  accent: "#34d399",
} as const;

// public/icon.png is the logo arrow painted in the accent colour (`npm run icon`).
export async function logoDataUrl(): Promise<string> {
  const png = await readFile(join(process.cwd(), "public/icon.png"));
  return `data:image/png;base64,${png.toString("base64")}`;
}
