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

  it("parses polygon z rings by ignoring z", () => {
    const polygons = parseBuildingWkt("POLYGON Z ((0 0 0,10 0 0,10 10 0,0 0 0))");
    expect(polygons[0][0]).toEqual([[0, 0], [10, 0], [10, 10], [0, 0]]);
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
