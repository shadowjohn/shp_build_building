import { describe, expect, it } from "vitest";
import { parseHeightOutput } from "../src/lib/terrain-sampler.js";

describe("terrain sampler", () => {
  it("parses GDAL height output and treats nodata as zero", () => {
    expect(parseHeightOutput("81.2\n-32768\n\n97.5\n", 4)).toEqual([81.2, 0, 97.5, 0]);
  });
});
