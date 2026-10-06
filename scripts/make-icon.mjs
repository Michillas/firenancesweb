// Regenerates the tab icon from the logo artwork (public/logo-arrow.png, white on transparent) in the
// logo colour, so the favicon always matches the in-app logo. Usage: npm run icon -- 34d399
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync, crc32 } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hex = (process.argv[2] ?? "34d399").replace("#", "");
const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

const src = readFileSync(join(root, "public/logo-arrow.png"));
let pos = 8;
let width = 0;
let height = 0;
const idat = [];
while (pos < src.length) {
  const len = src.readUInt32BE(pos);
  const type = src.toString("ascii", pos + 4, pos + 8);
  const body = src.subarray(pos + 8, pos + 8 + len);
  if (type === "IHDR") [width, height] = [body.readUInt32BE(0), body.readUInt32BE(4)];
  if (type === "IDAT") idat.push(body);
  pos += 12 + len;
}
// logo-arrow.png is written RGBA with filter 0 on every row (see git history), so rows can be patched in place.
const raw = inflateSync(Buffer.concat(idat));
const stride = width * 4 + 1;
for (let y = 0; y < height; y++) {
  if (raw[y * stride] !== 0) throw new Error("Unexpected PNG filter: regenerate logo-arrow.png unfiltered");
  for (let x = 0; x < width; x++) {
    const i = y * stride + 1 + x * 4;
    [raw[i], raw[i + 1], raw[i + 2]] = rgb;
  }
}
const chunk = (type, body) => {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "ascii");
  body.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), body])) >>> 0, 8 + body.length);
  return out;
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr.set([8, 6, 0, 0, 0], 8);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
for (const out of ["app/icon.png", "public/icon.png"]) writeFileSync(join(root, out), png);
console.log(`[icon] app/icon.png + public/icon.png painted #${hex}`);
