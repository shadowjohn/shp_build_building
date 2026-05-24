import fs from "node:fs";
import { spawnSync } from "node:child_process";

function parseHeight(value) {
  const numeric = Number(String(value).trim());
  if (!Number.isFinite(numeric) || numeric <= -32000) return 0;
  return numeric;
}

export function parseHeightOutput(output, expectedCount) {
  const lines = output.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const heights = lines.map(parseHeight);
  while (heights.length < expectedCount) heights.push(0);
  return heights.slice(0, expectedCount);
}

function chunkPoints(points, size) {
  const chunks = [];
  for (let i = 0; i < points.length; i += size) chunks.push(points.slice(i, i + size));
  return chunks;
}

export function createTerrainSampler(config) {
  if (config.heightMode !== "terrain") {
    return {
      mode: "height0",
      source: null,
      sampleMany(points) {
        return points.map(() => 0);
      }
    };
  }

  if (!fs.existsSync(config.terrain.raster)) {
    throw new Error(`Terrain raster not found: ${config.terrain.raster}`);
  }
  if (!fs.existsSync(config.gdal.gdallocationinfo)) {
    throw new Error(`gdallocationinfo not found: ${config.gdal.gdallocationinfo}`);
  }

  return {
    mode: "terrain",
    source: config.terrain.raster,
    sampleMany(points) {
      const heights = [];
      const chunks = chunkPoints(points, config.terrain.sampleChunkSize);
      for (const chunk of chunks) {
        const stdin = chunk.map((point) => `${point.lon} ${point.lat}`).join("\n");
        const result = spawnSync(config.gdal.gdallocationinfo, ["-wgs84", "-valonly", config.terrain.raster], {
          input: stdin,
          encoding: "utf8",
          maxBuffer: Math.max(1024 * 1024 * 16, chunk.length * 64)
        });
        if (result.status !== 0) {
          throw new Error(`gdallocationinfo failed: ${(result.stderr || result.stdout || "").trim()}`);
        }
        heights.push(...parseHeightOutput(result.stdout, chunk.length));
      }
      return heights;
    }
  };
}
