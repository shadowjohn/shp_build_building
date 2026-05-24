import { describe, expect, it } from "vitest";
import { lonLatToTilePixel } from "../src/lib/web-mercator-tiles.js";
import { matchRoofStyle } from "../src/lib/texture-style-matcher.js";

describe("imagery style matching", () => {
  it("converts lon/lat to stable slippy tile pixel coordinates", () => {
    const p = lonLatToTilePixel(120.665, 24.15, 16);
    expect(p.x).toBeGreaterThan(54000);
    expect(p.y).toBeGreaterThan(28000);
    expect(p.pixelX).toBeGreaterThanOrEqual(0);
    expect(p.pixelX).toBeLessThan(256);
  });

  it("matches sampled roof color to a deterministic muted style index", () => {
    const warmGray = matchRoofStyle({ r: 203, g: 195, b: 180 });
    const coolGray = matchRoofStyle({ r: 194, g: 203, b: 208 });
    expect(warmGray).not.toBe(coolGray);
    expect(matchRoofStyle(null)).toBe(0);
  });
});
