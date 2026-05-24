import zlib from "node:zlib";

export const TEXTURE_STYLE_COUNT = 10;

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuffer, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function rgba(hex) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

function blend(a, b, t) {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
    255
  ];
}

function fillRect(pixels, width, x, y, w, h, color) {
  const [r, g, b, a] = color;
  const minX = Math.max(0, Math.floor(x));
  const minY = Math.max(0, Math.floor(y));
  const maxX = Math.min(width, Math.ceil(x + w));
  const maxY = Math.min(width, Math.ceil(y + h));
  for (let py = minY; py < maxY; py += 1) {
    for (let px = minX; px < maxX; px += 1) {
      const offset = (py * width + px) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = a;
    }
  }
}

const STYLES = [
  ["#e1dfd8", "#747875", "#c9c6bd"],
  ["#dedfdb", "#6f777c", "#c3c8c8"],
  ["#e5e0d6", "#7b746c", "#ccc3b4"],
  ["#dcdfd8", "#737a73", "#c5cbc1"],
  ["#e4e2dc", "#777879", "#cbc9c2"],
  ["#dde2e4", "#6e7882", "#c2cbd0"],
  ["#e3ded8", "#7a746f", "#cbbfb5"],
  ["#e8e7e2", "#767673", "#d0cec6"],
  ["#dedfdc", "#737773", "#c6c9c3"],
  ["#e1e4e6", "#6f7880", "#c9ced1"]
];

export function styleRoofColor(styleIndex) {
  return rgba(STYLES[normalizeStyleIndex(styleIndex)][2]);
}

export function normalizeStyleIndex(styleIndex, styleCount = TEXTURE_STYLE_COUNT) {
  return ((Math.floor(Number(styleIndex) || 0) % styleCount) + styleCount) % styleCount;
}

export function createTexturePng({ kind, styleIndex, size = 128 }) {
  const style = STYLES[normalizeStyleIndex(styleIndex)];
  const pixels = Buffer.alloc(size * size * 4);
  fillRect(pixels, size, 0, 0, size, size, rgba(style[0]));

  if (kind === "ground") {
    const base = rgba(style[0]);
    const dark = rgba(style[1]);
    const frame = blend(base, dark, 0.52);
    const glass = blend(base, rgba("#d7e7ec"), 0.45);
    const shadow = blend(base, dark, 0.26);
    fillRect(pixels, size, 0, 86, size, 3, shadow);
    for (let x = 6; x < size; x += 40) {
      fillRect(pixels, size, x, 48, 22, 38, frame);
      fillRect(pixels, size, x + 3, 52, 16, 14, glass);
      fillRect(pixels, size, x + 4, 68, 6, 16, blend(base, dark, 0.62));
      fillRect(pixels, size, x + 12, 68, 6, 16, blend(base, dark, 0.38));
    }
    for (let x = 0; x < size; x += 32) fillRect(pixels, size, x, 0, 2, size, shadow);
  } else if (kind === "wall") {
    const base = rgba(style[0]);
    const dark = rgba(style[1]);
    const shade = rgba(style[2]);
    const seam = blend(base, shade, 0.28);
    const window = blend(base, dark, 0.48);
    const glass = blend(base, rgba("#d9eef5"), 0.42);
    for (let y = 0; y < size; y += 32) fillRect(pixels, size, 0, y, size, 1, seam);
    for (let y = 9; y < size; y += 28) {
      for (let x = 10; x < size; x += 34) {
        fillRect(pixels, size, x, y, 10, 5, window);
        fillRect(pixels, size, x + 2, y + 1, 3, 3, glass);
      }
    }
  } else {
    const base = rgba(style[0]);
    const seam = blend(base, rgba(style[1]), 0.16);
    fillRect(pixels, size, 0, 0, size, size, blend(base, rgba(style[2]), 0.1));
    for (let y = 0; y < size; y += 48) fillRect(pixels, size, 0, y, size, 1, seam);
    fillRect(pixels, size, 10, 10, 30, 16, blend(base, rgba("#f0f2ef"), 0.55));
    fillRect(pixels, size, 82, 62, 24, 18, blend(base, rgba("#6f7f86"), 0.35));
  }

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    scanlines[rowOffset] = 0;
    pixels.copy(scanlines, rowOffset + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
