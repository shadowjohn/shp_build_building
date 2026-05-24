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
    expect(createMaterialForBuilding({ id: 1, heightMeters: 80, areaMeters: 100, profile: "height-debug" }).wall.name).toBe("height-debug-wall-5");
  });

  it("assigns textured wall and roof styles from sampled imagery style index", () => {
    const mat = createMaterialForBuilding({ id: 42, heightMeters: 22, areaMeters: 150, profile: "textured", textureStyleIndex: 7 });
    expect(mat.ground.texture.kind).toBe("ground");
    expect(mat.wall.texture.kind).toBe("wall");
    expect(mat.roof.texture.kind).toBe("roof");
    expect(mat.ground.texture.styleIndex).toBe(7);
    expect(mat.wall.texture.styleIndex).toBe(7);
    expect(mat.roof.texture.styleIndex).toBe(7);
  });
});
