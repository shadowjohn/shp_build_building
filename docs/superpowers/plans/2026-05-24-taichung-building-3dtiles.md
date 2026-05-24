# Taichung Building 3D Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local offline CLI that converts county-separated building footprints from `input/<county>/` into Cesium-compatible 3D Tiles tilesets.

**Architecture:** Use a Node.js CLI for input discovery, geometry processing, mesh generation, GLB/B3DM writing, tileset manifest writing, and a static Cesium viewer. GDAL/OGR and SQLite are used only for source inspection and data access; output is written under `output/<county>/<profile>`, starting with Taichung.

**Tech Stack:** Node.js 24, npm, `better-sqlite3`, `earcut`, `proj4`, `vitest`, GDAL/OGR from `C:\ms4w_MSSQL\GDAL`, Cesium static viewer.

---

## File Structure

- Create `package.json`: scripts and dependencies for CLI, tests, and viewer server.
- Create `input/.gitkeep`: keep the drop folder in git while ignoring large source data.
- Create `src/config.js`: default input/output roots, county/profile settings, coordinate system, height, material, and tiling settings.
- Create `src/lib/input-discovery.js`: find county folders and choose `.db` or `.shp` sources.
- Create `src/lib/logger.js`: timestamped console and file logging.
- Create `src/lib/projection.js`: EPSG:3826 to WGS84 conversion helpers.
- Create `src/lib/materials.js`: deterministic procedural material classification and colors.
- Create `src/lib/wkt.js`: parse `POLYGON` and `GEOMETRYCOLLECTION(POLYGON...)` WKT into rings.
- Create `src/lib/geometry.js`: ring cleanup, area, bbox, centroid, and height rules.
- Create `src/lib/mesh-builder.js`: extrude one building footprint into wall and roof mesh buffers.
- Create `src/lib/glb-writer.js`: write a minimal GLB 2.0 from mesh buffers and materials.
- Create `src/lib/b3dm-writer.js`: wrap GLB into B3DM content for Cesium 3D Tiles 1.0.
- Create `src/lib/tileset-writer.js`: write tile content, `tileset.json`, and `manifest.json`.
- Create `src/lib/shp-normalizer.js`: convert dropped shapefiles into a working SQLite table with `GEOMETRY_WKT`.
- Create `src/lib/source-reader.js`: stream building rows from SQLite with bbox and limit filters.
- Create `src/build-taichung.js`: CLI entry point for sample, bbox, and full-city builds.
- Create `demo.html`, `viewer/js/app.js`, `viewer/css/style.css`: local Easymap CDN verification viewer with terrain and 3D Tiles.
- Create `tests/*.test.js`: focused unit tests for material, WKT, projection, mesh, and B3DM/tileset headers.
- Modify `.gitignore`: ignore `node_modules/`, `output/`, `logs/`, and temp build folders.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `input/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create package metadata and scripts**

Write `package.json`:

```json
{
  "name": "shp-build-building",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "check": "node --check src/build-taichung.js",
    "build:sample": "node src/build-taichung.js --county taichung --profile procedural --sample 200 --force",
    "build:bbox": "node src/build-taichung.js --county taichung --profile procedural --bbox 120.64,24.12,120.69,24.17 --force",
    "build:taichung": "node src/build-taichung.js --county taichung --profile procedural --full --force",
    "build:taichung:white": "node src/build-taichung.js --county taichung --profile white --full --force",
    "build:taichung:height": "node src/build-taichung.js --county taichung --profile height-debug --full --force",
    "serve:viewer": "npx http-server . -p 8088 -c-1"
  },
  "dependencies": {
    "better-sqlite3": "^12.10.0",
    "earcut": "^3.0.2",
    "proj4": "^2.20.8"
  },
  "devDependencies": {
    "http-server": "^14.1.1",
    "vitest": "^4.0.0"
  }
}
```

- [ ] **Step 2: Extend `.gitignore`**

Set `.gitignore` to:

```gitignore
.superpowers/
input/*
!input/.gitkeep
node_modules/
output/
cache/
logs/
*.tmp
```

- [ ] **Step 3: Keep input folder**

Create an empty file:

```text
input/.gitkeep
```

- [ ] **Step 4: Install dependencies**

Run:

```powershell
npm install
```

Expected: `package-lock.json` is created and npm exits with code `0`.

- [ ] **Step 5: Commit scaffold**

Run:

```powershell
git add package.json package-lock.json .gitignore input/.gitkeep
git commit -m "chore: scaffold building tiles tool"
```

Expected: commit succeeds.

---

### Task 2: Configuration And Logging

**Files:**
- Create: `src/config.js`
- Create: `src/lib/input-discovery.js`
- Create: `src/lib/logger.js`
- Test: `tests/config-logger.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/config-logger.test.js`:

```js
import { describe, expect, it } from "vitest";
import { defaultConfig, resolveBuildConfig } from "../src/config.js";
import { resolveCountySource } from "../src/lib/input-discovery.js";
import { createMemoryLogger } from "../src/lib/logger.js";

describe("config", () => {
  it("keeps input, output, profile, and EPSG assumptions explicit", () => {
    expect(defaultConfig.input.root).toBe("input");
    expect(defaultConfig.output.root).toBe("output");
    expect(defaultConfig.source.srs).toBe("EPSG:3826");
    expect(defaultConfig.profiles.procedural.kind).toBe("procedural");
    expect(defaultConfig.profiles.white.kind).toBe("white");
    expect(defaultConfig.height.floorMeters).toBe(3.3);
  });

  it("resolves sample mode", () => {
    const cfg = resolveBuildConfig(["--county", "taichung", "--profile", "white", "--sample", "25", "--force"]);
    expect(cfg.county).toBe("taichung");
    expect(cfg.profile).toBe("white");
    expect(cfg.mode).toBe("sample");
    expect(cfg.sample).toBe(25);
    expect(cfg.force).toBe(true);
  });
});

describe("input discovery", () => {
  it("prefers sqlite db over shapefile when both are present", () => {
    const source = resolveCountySource({
      county: "taichung",
      files: ["8.shp", "8.shx", "8.dbf", "8.db"]
    });
    expect(source.kind).toBe("sqlite");
    expect(source.file).toBe("8.db");
  });
});

describe("logger", () => {
  it("records info and warning counts", () => {
    const logger = createMemoryLogger();
    logger.info("start");
    logger.warn("bad feature");
    expect(logger.entries.map((entry) => entry.level)).toEqual(["info", "warn"]);
    expect(logger.counts.warn).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm test -- tests/config-logger.test.js
```

Expected: fails because `src/config.js`, `src/lib/input-discovery.js`, and `src/lib/logger.js` do not exist.

- [ ] **Step 3: Implement config**

Create `src/config.js`:

```js
import path from "node:path";

export const defaultConfig = {
  input: {
    root: "input"
  },
  source: {
    table: "8",
    idField: "ogc_fid",
    wktField: "GEOMETRY_WKT",
    floorField: "b1d",
    typeField: "b1b",
    structureField: "b1c",
    srs: "EPSG:3826"
  },
  gdal: {
    ogr2ogr: "C:\\ms4w_MSSQL\\GDAL\\ogr2ogr.exe",
    ogrinfo: "C:\\ms4w_MSSQL\\GDAL\\ogrinfo.exe"
  },
  output: {
    root: "output",
    tmpPrefix: ".tmp-buildings-",
    tilesDir: "tiles",
    logsDir: "logs"
  },
  height: {
    floorMeters: 3.3,
    fallbackMeters: 3.3,
    maxMeters: 260
  },
  tiling: {
    gridMeters: 750,
    maxFeaturesPerTile: 1800,
    geometricErrorRoot: 500,
    geometricErrorTile: 40
  },
  material: {
    version: "procedural-v1"
  },
  profiles: {
    white: { kind: "white", label: "White model" },
    procedural: { kind: "procedural", label: "Procedural city material" },
    "height-debug": { kind: "height-debug", label: "Height debug colors" },
    textured: { kind: "textured", label: "Reserved textured profile" }
  }
};

export function resolveBuildConfig(argv = process.argv.slice(2)) {
  const cfg = structuredClone(defaultConfig);
  cfg.county = "taichung";
  cfg.profile = "procedural";
  cfg.mode = "sample";
  cfg.sample = 200;
  cfg.force = false;
  cfg.bbox = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--sample") {
      cfg.mode = "sample";
      cfg.sample = Number(argv[++i]);
    } else if (arg === "--county") {
      cfg.county = argv[++i];
    } else if (arg === "--profile") {
      cfg.profile = argv[++i];
    } else if (arg === "--bbox") {
      cfg.mode = "bbox";
      cfg.bbox = argv[++i].split(",").map(Number);
    } else if (arg === "--full") {
      cfg.mode = "full";
      cfg.sample = null;
    } else if (arg === "--force") {
      cfg.force = true;
    } else if (arg === "--out") {
      cfg.output.root = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (cfg.mode === "sample" && (!Number.isFinite(cfg.sample) || cfg.sample <= 0)) {
    throw new Error("--sample must be a positive number");
  }
  if (cfg.mode === "bbox" && (!cfg.bbox || cfg.bbox.length !== 4 || cfg.bbox.some((v) => !Number.isFinite(v)))) {
    throw new Error("--bbox must be minLon,minLat,maxLon,maxLat");
  }
  if (!cfg.county || !/^[a-z0-9_-]+$/i.test(cfg.county)) {
    throw new Error("--county must use letters, numbers, underscore, or dash");
  }
  if (!cfg.profiles[cfg.profile]) {
    throw new Error(`Unknown profile: ${cfg.profile}`);
  }

  cfg.input.countyDir = path.resolve(cfg.input.root, cfg.county);
  cfg.output.profileRoot = path.resolve(cfg.output.root, cfg.county, cfg.profile);

  return cfg;
}
```

- [ ] **Step 4: Implement input discovery**

Create `src/lib/input-discovery.js`:

```js
import fs from "node:fs";
import path from "node:path";

export function resolveCountySource({ county, files }) {
  const db = files.find((file) => file.toLowerCase().endsWith(".db"));
  if (db) return { county, kind: "sqlite", file: db };
  const shp = files.find((file) => file.toLowerCase().endsWith(".shp"));
  if (shp) return { county, kind: "shp", file: shp };
  throw new Error(`No .db or .shp found for county: ${county}`);
}

export function discoverCountySource(countyDir, county) {
  if (!fs.existsSync(countyDir)) {
    throw new Error(`County input folder not found: ${countyDir}`);
  }
  const files = fs.readdirSync(countyDir);
  const source = resolveCountySource({ county, files });
  source.path = path.join(countyDir, source.file);
  return source;
}
```

- [ ] **Step 5: Implement logger**

Create `src/lib/logger.js`:

```js
import fs from "node:fs";
import path from "node:path";

function makeEntry(level, message, data) {
  return {
    ts: new Date().toISOString(),
    level,
    message,
    data: data ?? null
  };
}

export function createMemoryLogger() {
  const logger = {
    entries: [],
    counts: { info: 0, warn: 0, error: 0 },
    log(level, message, data) {
      const entry = makeEntry(level, message, data);
      this.entries.push(entry);
      this.counts[level] = (this.counts[level] ?? 0) + 1;
    },
    info(message, data) {
      this.log("info", message, data);
    },
    warn(message, data) {
      this.log("warn", message, data);
    },
    error(message, data) {
      this.log("error", message, data);
    }
  };
  return logger;
}

export function createFileLogger(logDir) {
  fs.mkdirSync(logDir, { recursive: true });
  const memory = createMemoryLogger();
  const logFile = path.join(logDir, `build-${new Date().toISOString().replaceAll(":", "")}.jsonl`);
  const write = memory.log.bind(memory);
  memory.log = (level, message, data) => {
    write(level, message, data);
    const entry = memory.entries.at(-1);
    fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`, "utf8");
    const line = data ? `${message} ${JSON.stringify(data)}` : message;
    console.log(`[${entry.ts}] ${level.toUpperCase()} ${line}`);
  };
  memory.logFile = logFile;
  return memory;
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```powershell
npm test -- tests/config-logger.test.js
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/config.js src/lib/input-discovery.js src/lib/logger.js tests/config-logger.test.js
git commit -m "feat: add build config and logging"
```

---

### Task 3: Projection, WKT, And Geometry Utilities

**Files:**
- Create: `src/lib/projection.js`
- Create: `src/lib/wkt.js`
- Create: `src/lib/geometry.js`
- Test: `tests/geometry.test.js`

- [ ] **Step 1: Write failing geometry tests**

Create `tests/geometry.test.js`:

```js
import { describe, expect, it } from "vitest";
import { twd97ToLonLat } from "../src/lib/projection.js";
import { parseBuildingWkt } from "../src/lib/wkt.js";
import { computeAreaMeters, computeHeightMeters, normalizeRing } from "../src/lib/geometry.js";

describe("projection", () => {
  it("converts Taichung TWD97 TM2 coordinates near the expected city center", () => {
    const [lon, lat] = twd97ToLonLat(214990.9985, 2665069.7109);
    expect(lon).toBeGreaterThan(120.55);
    expect(lon).toBeLessThan(120.8);
    expect(lat).toBeGreaterThan(24.0);
    expect(lat).toBeLessThan(24.3);
  });
});

describe("wkt parser", () => {
  it("parses polygon rings", () => {
    const polygons = parseBuildingWkt("POLYGON((0 0,10 0,10 10,0 10,0 0))");
    expect(polygons).toHaveLength(1);
    expect(polygons[0][0]).toEqual([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);
  });

  it("parses geometry collections containing polygons", () => {
    const polygons = parseBuildingWkt("GEOMETRYCOLLECTION(POLYGON((0 0,1 0,1 1,0 0)),POLYGON((2 2,3 2,3 3,2 2)))");
    expect(polygons).toHaveLength(2);
  });
});

describe("geometry", () => {
  it("removes duplicate closing point for mesh processing", () => {
    expect(normalizeRing([[0, 0], [1, 0], [0, 0]])).toEqual([[0, 0], [1, 0]]);
  });

  it("computes simple area in source meters", () => {
    expect(computeAreaMeters([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(100);
  });

  it("computes floor height and clamps spikes", () => {
    expect(computeHeightMeters(2, { floorMeters: 3.3, fallbackMeters: 3.3, maxMeters: 260 })).toBe(6.6);
    expect(computeHeightMeters(0, { floorMeters: 3.3, fallbackMeters: 3.3, maxMeters: 260 })).toBe(3.3);
    expect(computeHeightMeters(999, { floorMeters: 3.3, fallbackMeters: 3.3, maxMeters: 260 })).toBe(260);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm test -- tests/geometry.test.js
```

Expected: fails because modules do not exist.

- [ ] **Step 3: Implement projection**

Create `src/lib/projection.js`:

```js
import proj4 from "proj4";

proj4.defs("EPSG:3826", "+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

export function twd97ToLonLat(x, y) {
  return proj4("EPSG:3826", "EPSG:4326", [Number(x), Number(y)]);
}

export function ringToLonLat(ring) {
  return ring.map(([x, y]) => twd97ToLonLat(x, y));
}
```

- [ ] **Step 4: Implement WKT parser**

Create `src/lib/wkt.js`:

```js
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function parsePolygon(wkt) {
  const match = wkt.trim().match(/^POLYGON\s*\(\s*(.*)\s*\)$/i);
  if (!match) return [];
  const ringsText = splitTopLevel(match[1].trim().replace(/^\(/, "").replace(/\)$/, ""));
  return ringsText.map((ringText) => ringText
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((pair) => pair.trim().split(/\s+/).slice(0, 2).map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
}

export function parseBuildingWkt(wkt) {
  if (!wkt || typeof wkt !== "string") return [];
  const trimmed = wkt.trim();
  if (/^POLYGON/i.test(trimmed)) {
    const polygon = parsePolygon(trimmed);
    return polygon.length ? [polygon] : [];
  }
  if (/^GEOMETRYCOLLECTION/i.test(trimmed)) {
    const inner = trimmed.replace(/^GEOMETRYCOLLECTION\s*\(/i, "").replace(/\)$/, "");
    return splitTopLevel(inner).flatMap((part) => parseBuildingWkt(part));
  }
  return [];
}
```

- [ ] **Step 5: Implement geometry helpers**

Create `src/lib/geometry.js`:

```js
export function normalizeRing(ring) {
  const clean = ring.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (clean.length > 1) {
    const first = clean[0];
    const last = clean.at(-1);
    if (first[0] === last[0] && first[1] === last[1]) {
      return clean.slice(0, -1);
    }
  }
  return clean;
}

export function computeAreaMeters(ring) {
  const clean = normalizeRing(ring);
  let sum = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const [x1, y1] = clean[i];
    const [x2, y2] = clean[(i + 1) % clean.length];
    sum += (x1 * y2) - (x2 * y1);
  }
  return Math.abs(sum) / 2;
}

export function computeBbox(ring) {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function computeCentroid(ring) {
  const clean = normalizeRing(ring);
  const sx = clean.reduce((sum, [x]) => sum + x, 0);
  const sy = clean.reduce((sum, [, y]) => sum + y, 0);
  return [sx / clean.length, sy / clean.length];
}

export function computeHeightMeters(floors, heightConfig) {
  const numeric = Number(floors);
  if (!Number.isFinite(numeric) || numeric <= 0) return heightConfig.fallbackMeters;
  return Math.min(numeric * heightConfig.floorMeters, heightConfig.maxMeters);
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```powershell
npm test -- tests/geometry.test.js
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/lib/projection.js src/lib/wkt.js src/lib/geometry.js tests/geometry.test.js
git commit -m "feat: add building geometry utilities"
```

---

### Task 4: Procedural Materials

**Files:**
- Create: `src/lib/materials.js`
- Test: `tests/materials.test.js`

- [ ] **Step 1: Write failing material tests**

Create `tests/materials.test.js`:

```js
import { describe, expect, it } from "vitest";
import { classifyBuilding, createMaterialForBuilding, stableUnit } from "../src/lib/materials.js";

describe("materials", () => {
  it("generates deterministic stable random values", () => {
    expect(stableUnit(123)).toBe(stableUnit(123));
    expect(stableUnit(123)).not.toBe(stableUnit(124));
  });

  it("classifies tall buildings by computed height", () => {
    expect(classifyBuilding({ heightMeters: 80, areaMeters: 200, b1b: "3", b1c: "3" })).toBe("tower");
    expect(classifyBuilding({ heightMeters: 9.9, areaMeters: 120, b1b: "3", b1c: "3" })).toBe("lowrise");
    expect(classifyBuilding({ heightMeters: 12, areaMeters: 2500, b1b: "3", b1c: "3" })).toBe("large");
  });

  it("returns wall and roof rgba colors", () => {
    const mat = createMaterialForBuilding({ id: 7, heightMeters: 33, areaMeters: 500, b1b: "3", b1c: "3" });
    expect(mat.wall.baseColorFactor).toHaveLength(4);
    expect(mat.roof.baseColorFactor).toHaveLength(4);
    expect(mat.wall.name).toContain("wall");
    expect(mat.roof.name).toContain("roof");
  });

  it("supports white and height-debug profiles", () => {
    expect(createMaterialForBuilding({ id: 1, heightMeters: 20, areaMeters: 100, profile: "white" }).wall.name).toBe("white-wall");
    expect(createMaterialForBuilding({ id: 1, heightMeters: 80, areaMeters: 100, profile: "height-debug" }).wall.name).toBe("height-debug-wall");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/materials.test.js
```

Expected: fails because material module does not exist.

- [ ] **Step 3: Implement deterministic material rules**

Create `src/lib/materials.js`:

```js
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function stableUnit(seed) {
  let x = Number(seed) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 10000) / 10000;
}

export function classifyBuilding(building) {
  if (building.heightMeters >= 60) return "tower";
  if (building.areaMeters >= 1800) return "large";
  return "lowrise";
}

function rgba(r, g, b, a = 1) {
  return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
}

export function createMaterialForBuilding(building) {
  if (building.profile === "white") {
    return {
      type: "white",
      wall: { name: "white-wall", baseColorFactor: rgba(0.92, 0.92, 0.90, 1) },
      roof: { name: "white-roof", baseColorFactor: rgba(0.82, 0.82, 0.80, 1) }
    };
  }
  if (building.profile === "height-debug") {
    const t = clamp01(building.heightMeters / 90);
    return {
      type: "height-debug",
      wall: { name: "height-debug-wall", baseColorFactor: rgba(0.2 + t * 0.8, 0.8 - t * 0.5, 0.25, 1) },
      roof: { name: "height-debug-roof", baseColorFactor: rgba(0.15 + t * 0.7, 0.25, 0.85 - t * 0.5, 1) }
    };
  }
  const type = classifyBuilding(building);
  const n = stableUnit(building.id);
  const palettes = {
    lowrise: {
      wall: rgba(0.72 + n * 0.12, 0.70 + n * 0.10, 0.64 + n * 0.10, 1),
      roof: rgba(0.46 + n * 0.10, 0.23 + n * 0.08, 0.18 + n * 0.06, 1)
    },
    tower: {
      wall: rgba(0.48 + n * 0.10, 0.56 + n * 0.12, 0.62 + n * 0.12, 1),
      roof: rgba(0.24 + n * 0.08, 0.27 + n * 0.08, 0.30 + n * 0.08, 1)
    },
    large: {
      wall: rgba(0.58 + n * 0.10, 0.60 + n * 0.09, 0.57 + n * 0.08, 1),
      roof: rgba(0.30 + n * 0.12, 0.34 + n * 0.10, 0.36 + n * 0.08, 1)
    }
  };
  return {
    type,
    wall: { name: `${type}-wall`, baseColorFactor: palettes[type].wall },
    roof: { name: `${type}-roof`, baseColorFactor: palettes[type].roof }
  };
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```powershell
npm test -- tests/materials.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/lib/materials.js tests/materials.test.js
git commit -m "feat: add procedural building materials"
```

---

### Task 5: Source Reader And Shapefile Normalization

**Files:**
- Create: `src/lib/shp-normalizer.js`
- Create: `src/lib/source-reader.js`
- Test: `tests/source-reader.test.js`

- [ ] **Step 1: Write failing source reader tests**

Create `tests/source-reader.test.js`:

```js
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBuildings } from "../src/lib/source-reader.js";
import { normalizeSourceToSqlite } from "../src/lib/shp-normalizer.js";

const tmpFiles = [];

function makeDb() {
  const fp = path.join(os.tmpdir(), `building-reader-${Date.now()}-${Math.random()}.db`);
  tmpFiles.push(fp);
  const db = new Database(fp);
  db.exec("CREATE TABLE building (ogc_fid INTEGER PRIMARY KEY, b1d INTEGER, b1b TEXT, b1c TEXT, GEOMETRY_WKT TEXT)");
  db.prepare("INSERT INTO building VALUES (?, ?, ?, ?, ?)").run(1, 2, "3", "3", "POLYGON((214990 2665060,215000 2665060,215000 2665070,214990 2665060))");
  db.prepare("INSERT INTO building VALUES (?, ?, ?, ?, ?)").run(2, 1, "3", "3", "POLYGON((195000 2600000,195010 2600000,195010 2600010,195000 2600000))");
  db.close();
  return fp;
}

afterEach(() => {
  for (const fp of tmpFiles.splice(0)) {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
});

describe("source reader", () => {
  it("reads rows with sample limit", () => {
    const sqlite = makeDb();
    const rows = [...readBuildings({ sqlite, table: "building", sample: 1 })];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
  });

  it("filters by WGS84 bbox using centroid conversion", () => {
    const sqlite = makeDb();
    const rows = [...readBuildings({ sqlite, table: "building", bbox: [120.5, 24.0, 120.8, 24.3] })];
    expect(rows.map((row) => row.id)).toEqual([1]);
  });
});

describe("shapefile normalizer", () => {
  it("returns sqlite source directly when input is already sqlite", () => {
    const source = normalizeSourceToSqlite({
      source: { kind: "sqlite", path: "input/taichung/8.db" },
      workDir: "cache/taichung",
      table: "8"
    });
    expect(source.sqlite).toBe("input/taichung/8.db");
    expect(source.table).toBe("8");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/source-reader.test.js
```

Expected: fails because `source-reader.js` and `shp-normalizer.js` do not exist.

- [ ] **Step 3: Implement shapefile normalizer**

Create `src/lib/shp-normalizer.js`:

```js
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function normalizeSourceToSqlite({ source, workDir, table, ogr2ogr = "C:\\ms4w_MSSQL\\GDAL\\ogr2ogr.exe" }) {
  if (source.kind === "sqlite") {
    return { sqlite: source.path, table };
  }
  if (source.kind !== "shp") {
    throw new Error(`Unsupported source kind: ${source.kind}`);
  }

  fs.mkdirSync(workDir, { recursive: true });
  const sqlite = path.join(workDir, `${source.county}.sqlite`);
  fs.rmSync(sqlite, { force: true });
  execFileSync(ogr2ogr, [
    "-f", "SQLite",
    "-lco", "GEOMETRY_NAME=GEOMETRY",
    "-dialect", "SQLite",
    "-sql", `SELECT *, ST_AsText(geometry) AS GEOMETRY_WKT FROM "${path.basename(source.path, ".shp")}"`,
    sqlite,
    source.path,
    "-nln", table
  ], { stdio: "inherit" });
  return { sqlite, table };
}
```

- [ ] **Step 4: Implement source reader**

Create `src/lib/source-reader.js`:

```js
import Database from "better-sqlite3";
import { computeCentroid } from "./geometry.js";
import { twd97ToLonLat } from "./projection.js";
import { parseBuildingWkt } from "./wkt.js";

function insideBbox(lonLat, bbox) {
  if (!bbox) return true;
  const [lon, lat] = lonLat;
  return lon >= bbox[0] && lat >= bbox[1] && lon <= bbox[2] && lat <= bbox[3];
}

export function* readBuildings(options) {
  const db = new Database(options.sqlite, { readonly: true, fileMustExist: true });
  const table = options.table;
  const limit = options.sample ? ` LIMIT ${Number(options.sample)}` : "";
  const sql = `SELECT ogc_fid, b1d, b1b, b1c, GEOMETRY_WKT FROM "${table}" ORDER BY ogc_fid${limit}`;
  try {
    for (const row of db.prepare(sql).iterate()) {
      const polygons = parseBuildingWkt(row.GEOMETRY_WKT);
      if (!polygons.length || !polygons[0].length || polygons[0][0].length < 3) continue;
      const centroid = computeCentroid(polygons[0][0]);
      const lonLat = twd97ToLonLat(centroid[0], centroid[1]);
      if (!insideBbox(lonLat, options.bbox)) continue;
      yield {
        id: row.ogc_fid,
        floors: row.b1d,
        b1b: row.b1b,
        b1c: row.b1c,
        polygons,
        centroid,
        lonLat
      };
    }
  } finally {
    db.close();
  }
}
```

- [ ] **Step 5: Verify tests pass**

Run:

```powershell
npm test -- tests/source-reader.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/lib/shp-normalizer.js src/lib/source-reader.js tests/source-reader.test.js
git commit -m "feat: read building rows from sqlite"
```

---

### Task 6: Mesh Builder And GLB/B3DM Writers

**Files:**
- Create: `src/lib/mesh-builder.js`
- Create: `src/lib/glb-writer.js`
- Create: `src/lib/b3dm-writer.js`
- Test: `tests/mesh-tiles-content.test.js`

- [ ] **Step 1: Write failing mesh/content tests**

Create `tests/mesh-tiles-content.test.js`:

```js
import { describe, expect, it } from "vitest";
import { buildExtrudedMesh } from "../src/lib/mesh-builder.js";
import { createGlb } from "../src/lib/glb-writer.js";
import { createB3dm } from "../src/lib/b3dm-writer.js";

describe("mesh and tile content", () => {
  it("extrudes a rectangle into positions and indices", () => {
    const mesh = buildExtrudedMesh({
      id: 1,
      rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
      heightMeters: 6.6,
      materialIndex: 0
    });
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.min[2]).toBe(0);
    expect(mesh.max[2]).toBe(6.6);
  });

  it("creates GLB and B3DM headers", () => {
    const glb = createGlb({
      meshes: [buildExtrudedMesh({
        id: 1,
        rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
        heightMeters: 6.6,
        materialIndex: 0
      })],
      materials: [{ name: "wall", baseColorFactor: [1, 1, 1, 1] }]
    });
    expect(glb.slice(0, 4).toString("utf8")).toBe("glTF");
    const b3dm = createB3dm(glb);
    expect(b3dm.slice(0, 4).toString("utf8")).toBe("b3dm");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/mesh-tiles-content.test.js
```

Expected: fails because modules do not exist.

- [ ] **Step 3: Implement mesh builder**

Create `src/lib/mesh-builder.js` with rectangle/simple polygon support first:

```js
import earcut from "earcut";
import { normalizeRing } from "./geometry.js";

export function buildExtrudedMesh(building) {
  const ring = normalizeRing(building.rings[0]);
  const positions = [];
  const indices = [];

  for (const [x, y] of ring) positions.push(x, y, 0);
  for (const [x, y] of ring) positions.push(x, y, building.heightMeters);

  const flat = ring.flatMap(([x, y]) => [x, y]);
  const top = earcut(flat);
  const topOffset = ring.length;
  for (let i = 0; i < top.length; i += 3) {
    indices.push(topOffset + top[i], topOffset + top[i + 1], topOffset + top[i + 2]);
  }

  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    const b0 = i;
    const b1 = j;
    const t0 = topOffset + i;
    const t1 = topOffset + j;
    indices.push(b0, b1, t1, b0, t1, t0);
  }

  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return {
    id: building.id,
    materialIndex: building.materialIndex,
    positions,
    indices,
    min: [Math.min(...xs), Math.min(...ys), 0],
    max: [Math.max(...xs), Math.max(...ys), building.heightMeters]
  };
}
```

- [ ] **Step 4: Implement GLB writer**

Create `src/lib/glb-writer.js`:

```js
function pad4(buffer, padByte = 0x20) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, padByte)]) : buffer;
}

function floatBuffer(values) {
  const buffer = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer;
}

function indexBuffer(values) {
  const buffer = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buffer.writeUInt32LE(value, index * 4));
  return buffer;
}

export function createGlb({ meshes, materials }) {
  const positions = meshes.flatMap((mesh) => mesh.positions);
  let vertexOffset = 0;
  const indices = [];
  for (const mesh of meshes) {
    for (const index of mesh.indices) indices.push(index + vertexOffset);
    vertexOffset += mesh.positions.length / 3;
  }

  const positionBytes = floatBuffer(positions);
  const indexBytes = indexBuffer(indices);
  const bin = pad4(Buffer.concat([positionBytes, indexBytes]), 0);
  const json = {
    asset: { version: "2.0", generator: "shp_build_building" },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBytes.length, target: 34962 },
      { buffer: 0, byteOffset: positionBytes.length, byteLength: indexBytes.length, target: 34963 }
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: "VEC3" },
      { bufferView: 1, componentType: 5125, count: indices.length, type: "SCALAR" }
    ],
    materials: materials.map((material) => ({
      name: material.name,
      pbrMetallicRoughness: { baseColorFactor: material.baseColorFactor, metallicFactor: 0, roughnessFactor: 0.85 }
    })),
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0
  };
  const jsonChunk = pad4(Buffer.from(JSON.stringify(json), "utf8"));
  const totalLength = 12 + 8 + jsonChunk.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.write("JSON", 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.write("BIN\0", 4);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
}
```

- [ ] **Step 5: Implement B3DM writer**

Create `src/lib/b3dm-writer.js`:

```js
export function createB3dm(glb) {
  const header = Buffer.alloc(28);
  header.write("b3dm", 0);
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(28 + glb.length, 8);
  header.writeUInt32LE(0, 12);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(0, 20);
  header.writeUInt32LE(0, 24);
  return Buffer.concat([header, glb]);
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```powershell
npm test -- tests/mesh-tiles-content.test.js
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/lib/mesh-builder.js src/lib/glb-writer.js src/lib/b3dm-writer.js tests/mesh-tiles-content.test.js
git commit -m "feat: write extruded building tile content"
```

---

### Task 7: Tileset Writer

**Files:**
- Create: `src/lib/tileset-writer.js`
- Test: `tests/tileset-writer.test.js`

- [ ] **Step 1: Write failing tileset writer test**

Create `tests/tileset-writer.test.js`:

```js
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
      sourceSummary: { count: 1, srs: "EPSG:3826" },
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
    expect(tileset.asset.version).toBe("1.0");
    fs.rmSync(out, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/tileset-writer.test.js
```

Expected: fails because writer does not exist.

- [ ] **Step 3: Implement tileset writer**

Create `src/lib/tileset-writer.js`:

```js
import fs from "node:fs";
import path from "node:path";

function rad(deg) {
  return deg * Math.PI / 180;
}

function toRegionRadians(region) {
  return [rad(region[0]), rad(region[1]), rad(region[2]), rad(region[3]), region[4], region[5]];
}

function unionRegion(tiles) {
  return [
    Math.min(...tiles.map((tile) => tile.region[0])),
    Math.min(...tiles.map((tile) => tile.region[1])),
    Math.max(...tiles.map((tile) => tile.region[2])),
    Math.max(...tiles.map((tile) => tile.region[3])),
    Math.min(...tiles.map((tile) => tile.region[4])),
    Math.max(...tiles.map((tile) => tile.region[5]))
  ];
}

export function writeTileset({ outputRoot, sourceSummary, tiles }) {
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(outputRoot, "tiles"), { recursive: true });

  for (const tile of tiles) {
    fs.writeFileSync(path.join(outputRoot, "tiles", `${tile.id}.b3dm`), tile.content);
  }

  const rootRegion = unionRegion(tiles);
  const tileset = {
    asset: { version: "1.0", generator: "shp_build_building" },
    geometricError: 500,
    root: {
      boundingVolume: { region: toRegionRadians(rootRegion) },
      geometricError: 250,
      refine: "ADD",
      children: tiles.map((tile) => ({
        boundingVolume: { region: toRegionRadians(tile.region) },
        geometricError: 40,
        content: { uri: `tiles/${tile.id}.b3dm` },
        refine: "ADD"
      }))
    }
  };
  fs.writeFileSync(path.join(outputRoot, "tileset.json"), JSON.stringify(tileset, null, 2), "utf8");
  fs.writeFileSync(path.join(outputRoot, "manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: sourceSummary,
    tileCount: tiles.length,
    featureCount: tiles.reduce((sum, tile) => sum + tile.featureCount, 0)
  }, null, 2), "utf8");
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```powershell
npm test -- tests/tileset-writer.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/lib/tileset-writer.js tests/tileset-writer.test.js
git commit -m "feat: write 3d tiles tileset"
```

---

### Task 8: CLI Build Pipeline

**Files:**
- Create: `src/build-taichung.js`
- Test: `tests/build-cli.test.js`

- [ ] **Step 1: Write CLI smoke test**

Create `tests/build-cli.test.js`:

```js
import { describe, expect, it } from "vitest";
import { planTileId } from "../src/build-taichung.js";

describe("build cli helpers", () => {
  it("creates stable tile ids from source meter coordinates", () => {
    expect(planTileId([214999, 2665000], 750)).toBe("286_3553");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- tests/build-cli.test.js
```

Expected: fails because CLI does not exist.

- [ ] **Step 3: Implement CLI pipeline**

Create `src/build-taichung.js`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultConfig, resolveBuildConfig } from "./config.js";
import { computeAreaMeters, computeBbox, computeHeightMeters } from "./lib/geometry.js";
import { createB3dm } from "./lib/b3dm-writer.js";
import { createFileLogger } from "./lib/logger.js";
import { createGlb } from "./lib/glb-writer.js";
import { buildExtrudedMesh } from "./lib/mesh-builder.js";
import { createMaterialForBuilding } from "./lib/materials.js";
import { discoverCountySource } from "./lib/input-discovery.js";
import { readBuildings } from "./lib/source-reader.js";
import { normalizeSourceToSqlite } from "./lib/shp-normalizer.js";
import { ringToLonLat } from "./lib/projection.js";
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
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3]), Math.min(a[4], b[4]), Math.max(a[5], b[5])];
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
    if (!buckets.has(tileId)) buckets.set(tileId, { id: tileId, buildings: [], region: null });
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
        rings: [building.outerRing],
        heightMeters: building.heightMeters,
        materialIndex
      }));
    }
    const glb = createGlb({ meshes, materials });
    tiles.push({
      id: bucket.id,
      region: bucket.region,
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
```

- [ ] **Step 4: Verify tests and syntax**

Run:

```powershell
npm test -- tests/build-cli.test.js
node --check src/build-taichung.js
```

Expected: tests pass and syntax check exits with code `0`.

- [ ] **Step 5: Run sample build**

Run:

```powershell
npm run build:sample
```

Expected:

- `output/taichung/procedural/tileset.json` exists.
- `output/taichung/procedural/manifest.json` exists.
- at least one `.b3dm` exists under `output/taichung/procedural/tiles/`.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/build-taichung.js tests/build-cli.test.js
git commit -m "feat: add Taichung building build CLI"
```

---

### Task 9: Easymap Demo Viewer

**Files:**
- Create: `demo.html`
- Create: `viewer/css/style.css`
- Create: `viewer/js/app.js`

- [ ] **Step 1: Create Easymap demo HTML**

Create `demo.html`:

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Easymap Taichung Building 3D Tiles Demo</title>
  <link rel="stylesheet" href="/viewer/css/style.css">
  <script src="http://www.focusit.com.tw/easymap/easymap/easymap.js"></script>
</head>
<body>
  <div id="map"></div>
  <div id="panel">
    <strong>Taichung Buildings</strong>
    <label>
      Profile
      <select id="profile">
        <option value="procedural">procedural</option>
        <option value="white">white</option>
        <option value="height-debug">height-debug</option>
      </select>
    </label>
    <div id="status">Loading...</div>
    <button id="flyHome" type="button">Fly Taichung</button>
  </div>
  <script src="/viewer/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create viewer CSS**

Create `viewer/css/style.css`:

```css
html,
body,
#map {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  font-family: Arial, "Microsoft JhengHei", sans-serif;
}

#panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  width: 240px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 6px;
  font-size: 13px;
}

#status {
  margin: 8px 0;
  line-height: 1.45;
}

button {
  padding: 6px 10px;
  cursor: pointer;
}
```

- [ ] **Step 3: Create viewer app**

Create `viewer/js/app.js`:

```js
(async function main() {
  const status = document.getElementById("status");
  function setStatus(text) {
    status.textContent = text;
  }

  const params = new URLSearchParams(location.search);
  const county = params.get("county") || "taichung";
  const profileSelect = document.getElementById("profile");
  profileSelect.value = params.get("profile") || "procedural";

  const map = new Easymap("map");
  map.enable3D(async function () {
    const viewer = map._olcesium.ol3d.getCesiumScene
      ? map._olcesium.ol3d.getCesiumScene()._view
      : map.get3DViewer();
    const cesiumViewer = map.get3DViewer ? map.get3DViewer() : viewer;
    const sceneViewer = cesiumViewer.scene ? cesiumViewer : window.viewer;

    try {
      sceneViewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(`/data/terrain20M/${county}`, {
        requestVertexNormals: true,
        requestWaterMask: false
      });
      setStatus(`Terrain loaded: ${county}`);
    } catch (error) {
      console.error(error);
      setStatus(`Terrain fallback: ${error.message}`);
    }

    async function loadTileset() {
      const profile = profileSelect.value;
      try {
        const tileset = await Cesium.Cesium3DTileset.fromUrl(`/output/${county}/${profile}/tileset.json`);
        sceneViewer.scene.primitives.add(tileset);
        await sceneViewer.zoomTo(tileset);
        setStatus(`Tileset loaded: ${county}/${profile}`);
      } catch (error) {
        console.error(error);
        setStatus(`Tileset failed: ${error.message}`);
      }
    }

    profileSelect.addEventListener("change", loadTileset);
    document.getElementById("flyHome").addEventListener("click", () => {
      sceneViewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(120.66588368, 24.11933551, 3500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0
        }
      });
    });
    await loadTileset();
  });
}());
```

- [ ] **Step 4: Run syntax checks**

Run:

```powershell
node --check viewer/js/app.js
```

Expected: syntax check exits with code `0`.

- [ ] **Step 5: Run viewer server**

Run:

```powershell
npm run serve:viewer
```

Expected: server prints a URL on port `8088`. Open `http://localhost:8088/viewer/` and confirm the sample tileset loads.

- [ ] **Step 6: Commit**

Run:

```powershell
git add demo.html viewer/css/style.css viewer/js/app.js
git commit -m "feat: add Easymap tileset demo viewer"
```

---

### Task 10: BBox And Full-City Build Validation

**Files:**
- Modify: `src/build-taichung.js`
- Modify: `src/lib/tileset-writer.js`
- Test: existing tests

- [ ] **Step 1: Run all automated tests**

Run:

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run limited bbox build**

Run:

```powershell
npm run build:bbox
```

Expected:

- build exits with code `0`
- `output/taichung/procedural/tileset.json` exists
- `output/taichung/procedural/manifest.json` reports mode `bbox`
- viewer can load the output

- [ ] **Step 3: Run full-city build**

Run:

```powershell
npm run build:taichung
```

Expected:

- build exits with code `0`
- `output/taichung/procedural/tileset.json` exists
- `output/taichung/procedural/manifest.json` reports mode `full`
- manifest feature count is close to the source count minus invalid geometries
- log contains final tile count

- [ ] **Step 4: Inspect full output**

Run:

```powershell
Get-Content -LiteralPath .\output\taichung\procedural\manifest.json
Get-ChildItem -LiteralPath .\output\taichung\procedural\tiles -Filter *.b3dm | Measure-Object
```

Expected: manifest is readable JSON and tile count is greater than `1`.

- [ ] **Step 5: Commit validation tweaks only if code changed**

If Task 10 required code changes, run:

```powershell
git add src/build-taichung.js src/lib/tileset-writer.js tests
git commit -m "fix: stabilize full Taichung building build"
```

If no code changed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Full-city offline output is covered by Tasks 8 and 10.
- Visible height differences are covered by Tasks 3, 6, and 8.
- Procedural materials are covered by Task 4 and used in Task 8.
- Stable reruns, logs, and manifest are covered by Tasks 2, 7, 8, and 10.
- Existing id=365 behavior is represented by the `b1d * 3.3m` height rule in Tasks 3 and 8.
- Viewer verification is covered by Task 9.

Task steps were scanned for incomplete planning language. Deferred features from the design spec remain outside this MVP plan.
