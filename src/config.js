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
    ogrinfo: "C:\\ms4w_MSSQL\\GDAL\\ogrinfo.exe",
    gdallocationinfo: "C:\\ms4w_MSSQL\\GDAL\\gdallocationinfo.exe"
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
    parentGridTiles: 4,
    maxFeaturesPerTile: 1800,
    geometricErrorRoot: 500,
    geometricErrorParent: 180,
    geometricErrorTile: 80
  },
  material: {
    version: "procedural-v1"
  },
  terrain: {
    root: "D:\\mytools\\dem20M_terrain\\data\\work",
    rasterSuffix: "-4326.tif",
    sampleChunkSize: 50000
  },
  imagery: {
    root: "cache\\imagery",
    provider: "google_satellite",
    zoom: 17,
    allowDownload: false,
    delayMs: 250,
    timeoutMs: 10000,
    maxDownloads: 0
  },
  outlines: {
    enabled: false,
    color: [0.12, 0.12, 0.12, 0.65]
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
  cfg.heightMode = "height0";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--sample") {
      cfg.mode = "sample";
      cfg.sample = Number(argv[++i]);
    } else if (arg === "--county") {
      cfg.county = argv[++i];
    } else if (arg === "--table") {
      cfg.source.table = argv[++i];
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
    } else if (arg === "--height-mode") {
      cfg.heightMode = argv[++i];
    } else if (arg === "--terrain-root") {
      cfg.terrain.root = argv[++i];
    } else if (arg === "--edges") {
      cfg.outlines.enabled = true;
    } else if (arg === "--no-edges") {
      cfg.outlines.enabled = false;
    } else if (arg === "--imagery-cache") {
      cfg.imagery.root = argv[++i];
    } else if (arg === "--imagery-provider") {
      cfg.imagery.provider = argv[++i];
    } else if (arg === "--imagery-zoom") {
      cfg.imagery.zoom = Number(argv[++i]);
    } else if (arg === "--download-imagery") {
      cfg.imagery.allowDownload = true;
      cfg.imagery.maxDownloads = Number(argv[++i]);
    } else if (arg === "--imagery-delay-ms") {
      cfg.imagery.delayMs = Number(argv[++i]);
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
  if (!["height0", "terrain"].includes(cfg.heightMode)) {
    throw new Error("--height-mode must be height0 or terrain");
  }
  if (!Number.isInteger(cfg.imagery.zoom) || cfg.imagery.zoom < 0 || cfg.imagery.zoom > 22) {
    throw new Error("--imagery-zoom must be an integer from 0 to 22");
  }
  if (cfg.imagery.allowDownload && (!Number.isFinite(cfg.imagery.maxDownloads) || cfg.imagery.maxDownloads <= 0)) {
    throw new Error("--download-imagery must be followed by a positive max download count");
  }

  cfg.input.countyDir = path.resolve(cfg.input.root, cfg.county);
  cfg.imagery.root = path.resolve(cfg.imagery.root);
  cfg.terrain.raster = path.resolve(cfg.terrain.root, cfg.county, `${cfg.county}${cfg.terrain.rasterSuffix}`);
  cfg.output.variant = `${cfg.profile}-${cfg.heightMode}${cfg.outlines.enabled ? "-edges" : ""}`;
  cfg.output.profileRoot = path.resolve(cfg.output.root, cfg.county, cfg.output.variant);

  return cfg;
}
