import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { tileUrl } from "./web-mercator-tiles.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function download(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs, headers: { "User-Agent": "shp-build-building/0.1 offline-cache" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("timeout", () => req.destroy(new Error("imagery request timeout")));
    req.on("error", reject);
  });
}

function decodeImage(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }
  const jpg = jpeg.decode(buffer, { useTArray: true });
  return { width: jpg.width, height: jpg.height, data: jpg.data };
}

export class ImageryCache {
  constructor(config) {
    this.provider = config.provider;
    this.root = config.root;
    this.allowDownload = config.allowDownload;
    this.delayMs = config.delayMs;
    this.timeoutMs = config.timeoutMs;
    this.maxDownloads = config.maxDownloads;
    this.downloadCount = 0;
    this.decoded = new Map();
    this.missing = new Set();
  }

  tilePath(tile) {
    return path.join(this.root, this.provider, String(tile.z), String(tile.x), `${tile.y}.jpg`);
  }

  async ensureTile(tile) {
    const file = this.tilePath(tile);
    const key = `${tile.z}/${tile.x}/${tile.y}`;
    if (this.missing.has(key)) return null;
    if (fs.existsSync(file)) return file;
    if (this.missing.has(key) || !this.allowDownload || this.downloadCount >= this.maxDownloads) {
      this.missing.add(key);
      return null;
    }
    await sleep(this.delayMs);
    const buffer = await download(tileUrl(this.provider, tile), this.timeoutMs);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buffer);
    this.downloadCount += 1;
    return file;
  }

  async sample(tile) {
    const file = await this.ensureTile(tile);
    if (!file) return null;
    if (!this.decoded.has(file)) {
      this.decoded.set(file, decodeImage(fs.readFileSync(file)));
    }
    const image = this.decoded.get(file);
    const x = Math.max(0, Math.min(image.width - 1, tile.pixelX));
    const y = Math.max(0, Math.min(image.height - 1, tile.pixelY));
    const offset = (y * image.width + x) * 4;
    return { r: image.data[offset], g: image.data[offset + 1], b: image.data[offset + 2] };
  }
}
