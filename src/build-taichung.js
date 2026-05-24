import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultConfig, resolveBuildConfig } from "./config.js";
import { computeAreaMeters, computeHeightMeters } from "./lib/geometry.js";
import { createB3dm } from "./lib/b3dm-writer.js";
import { createFileLogger } from "./lib/logger.js";
import { createGlb } from "./lib/glb-writer.js";
import { buildExtrudedMesh } from "./lib/mesh-builder.js";
import { createMaterialForBuilding } from "./lib/materials.js";
import { discoverCountySource } from "./lib/input-discovery.js";
import { readBuildings } from "./lib/source-reader.js";
import { normalizeSourceToSqlite } from "./lib/shp-normalizer.js";
import { eastNorthUpToFixedFrame, ringToLonLat, twd97ToLonLat } from "./lib/projection.js";
import { writeTileset } from "./lib/tileset-writer.js";

export function planTileId(centroid, gridMeters) {
  return `${Math.floor(centroid[0] / gridMeters)}_${Math.floor(centroid[1] / gridMeters)}`;
}

function regionFromRings(ringsLonLat, heightMeters) {
  const points = ringsLonLat.flat();
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats), 0, heightMeters];
}

function mergeRegion(a, b) {
  if (!a) return b;
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
    Math.min(a[4], b[4]),
    Math.max(a[5], b[5])
  ];
}

function localizeRing(ring, origin) {
  return ring.map(([x, y]) => [x - origin[0], y - origin[1]]);
}

function tileOriginFromId(tileId, gridMeters) {
  const [gx, gy] = tileId.split("_").map(Number);
  return [(gx + 0.5) * gridMeters, (gy + 0.5) * gridMeters];
}

export function build(config = resolveBuildConfig()) {
  const outRoot = config.output.profileRoot;
  if (fs.existsSync(outRoot) && !config.force) {
    throw new Error(`Output exists. Use --force to replace: ${outRoot}`);
  }
  fs.mkdirSync(path.join(outRoot, config.output.logsDir), { recursive: true });
  const logger = createFileLogger(path.join(outRoot, config.output.logsDir));
  const discovered = discoverCountySource(config.input.countyDir, config.county);
  const normalized = normalizeSourceToSqlite({
    source: discovered,
    workDir: path.resolve("cache", config.county),
    table: config.source.table,
    ogr2ogr: config.gdal.ogr2ogr
  });
  logger.info("build started", {
    county: config.county,
    profile: config.profile,
    mode: config.mode,
    source: discovered.path
  });

  const buckets = new Map();
  let readCount = 0;
  let skipped = 0;
  for (const row of readBuildings({
    sqlite: normalized.sqlite,
    table: normalized.table,
    sample: config.sample,
    bbox: config.bbox
  })) {
    readCount += 1;
    const outerRing = row.polygons[0][0];
    if (outerRing.length < 3) {
      skipped += 1;
      continue;
    }
    const heightMeters = computeHeightMeters(row.floors, config.height);
    const areaMeters = computeAreaMeters(outerRing);
    const material = createMaterialForBuilding({
      id: row.id,
      heightMeters,
      areaMeters,
      b1b: row.b1b,
      b1c: row.b1c,
      profile: config.profile
    });
    const tileId = planTileId(row.centroid, config.tiling.gridMeters);
    if (!buckets.has(tileId)) {
      const origin = tileOriginFromId(tileId, config.tiling.gridMeters);
      const [lon, lat] = twd97ToLonLat(origin[0], origin[1]);
      buckets.set(tileId, {
        id: tileId,
        origin,
        transform: eastNorthUpToFixedFrame(lon, lat, 0),
        buildings: [],
        region: null
      });
    }
    const bucket = buckets.get(tileId);
    const ringsLonLat = [ringToLonLat(outerRing)];
    bucket.region = mergeRegion(bucket.region, regionFromRings(ringsLonLat, heightMeters));
    bucket.buildings.push({ row, outerRing, heightMeters, areaMeters, material });
  }

  const tiles = [];
  for (const bucket of buckets.values()) {
    const meshes = [];
    const materials = [];
    for (const building of bucket.buildings) {
      const materialIndex = materials.length;
      materials.push(building.material.wall);
      meshes.push(buildExtrudedMesh({
        id: building.row.id,
        rings: [localizeRing(building.outerRing, bucket.origin)],
        heightMeters: building.heightMeters,
        materialIndex
      }));
    }
    const glb = createGlb({ meshes, materials });
    tiles.push({
      id: bucket.id,
      region: bucket.region,
      transform: bucket.transform,
      content: createB3dm(glb),
      featureCount: bucket.buildings.length
    });
  }

  if (!tiles.length) throw new Error("No tiles generated");
  writeTileset({
    outputRoot: outRoot,
    sourceSummary: {
      county: config.county,
      profile: config.profile,
      input: discovered.path,
      sqlite: normalized.sqlite,
      table: normalized.table,
      srs: config.source.srs,
      mode: config.mode,
      readCount,
      skipped,
      height: config.height,
      materialVersion: config.material.version
    },
    tiles
  });
  logger.info("build finished", { county: config.county, profile: config.profile, readCount, skipped, tileCount: tiles.length, output: outRoot });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  build(resolveBuildConfig(process.argv.slice(2), defaultConfig));
}
