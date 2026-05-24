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
