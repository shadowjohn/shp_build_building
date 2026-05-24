import { describe, expect, it } from "vitest";
import { planTileId } from "../src/build-taichung.js";

describe("build cli helpers", () => {
  it("creates stable tile ids from source meter coordinates", () => {
    expect(planTileId([214999, 2665000], 750)).toBe("286_3553");
  });
});
