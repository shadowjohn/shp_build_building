import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writeTileset } from "../src/lib/tileset-writer.js";

describe("tileset writer", () => {
  it("writes tileset, b3dm content, and manifest", () => {
    const out = path.join(os.tmpdir(), `tileset-${Date.now()}-${Math.random()}`);
    writeTileset({
      outputRoot: out,
      sourceSummary: { county: "taichung", profile: "procedural", count: 1, srs: "EPSG:3826" },
      tiles: [{
        id: "0_0",
        region: [120.6, 24.1, 120.7, 24.2, 0, 20],
        content: Buffer.from("b3dm-test"),
        featureCount: 1
      }]
    });
    expect(fs.existsSync(path.join(out, "tileset.json"))).toBe(true);
    expect(fs.existsSync(path.join(out, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(out, "tiles", "0_0.b3dm"))).toBe(true);
    const tileset = JSON.parse(fs.readFileSync(path.join(out, "tileset.json"), "utf8"));
    const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
    expect(tileset.asset.version).toBe("1.0");
    expect(manifest.source.county).toBe("taichung");
    fs.rmSync(out, { recursive: true, force: true });
  });
});
