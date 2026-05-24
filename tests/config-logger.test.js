import { describe, expect, it } from "vitest";
import { defaultConfig, resolveBuildConfig } from "../src/config.js";
import { resolveCountySource } from "../src/lib/input-discovery.js";
import { createMemoryLogger } from "../src/lib/logger.js";

describe("config", () => {
  it("keeps input, output, profile, GDAL, and EPSG assumptions explicit", () => {
    expect(defaultConfig.input.root).toBe("input");
    expect(defaultConfig.output.root).toBe("output");
    expect(defaultConfig.source.srs).toBe("EPSG:3826");
    expect(defaultConfig.gdal.ogr2ogr).toBe("C:\\ms4w_MSSQL\\GDAL\\ogr2ogr.exe");
    expect(defaultConfig.profiles.procedural.kind).toBe("procedural");
    expect(defaultConfig.profiles.white.kind).toBe("white");
    expect(defaultConfig.imagery.allowDownload).toBe(false);
    expect(defaultConfig.height.floorMeters).toBe(3.3);
  });

  it("resolves sample mode", () => {
    const cfg = resolveBuildConfig(["--county", "taichung", "--table", "8420", "--profile", "white", "--sample", "25", "--force"]);
    expect(cfg.county).toBe("taichung");
    expect(cfg.source.table).toBe("8420");
    expect(cfg.profile).toBe("white");
    expect(cfg.mode).toBe("sample");
    expect(cfg.sample).toBe(25);
    expect(cfg.force).toBe(true);
    expect(cfg.heightMode).toBe("height0");
    expect(cfg.output.profileRoot.endsWith("output\\taichung\\white-height0") || cfg.output.profileRoot.endsWith("output/taichung/white-height0")).toBe(true);
  });

  it("resolves terrain height mode and outline flag", () => {
    const cfg = resolveBuildConfig(["--county", "taichung", "--height-mode", "terrain", "--edges"]);
    expect(cfg.heightMode).toBe("terrain");
    expect(cfg.outlines.enabled).toBe(true);
    expect(cfg.output.variant).toBe("procedural-terrain-edges");
    expect(cfg.terrain.raster.endsWith("taichung-4326.tif")).toBe(true);
    expect(cfg.output.profileRoot.endsWith("output\\taichung\\procedural-terrain-edges") || cfg.output.profileRoot.endsWith("output/taichung/procedural-terrain-edges")).toBe(true);
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
