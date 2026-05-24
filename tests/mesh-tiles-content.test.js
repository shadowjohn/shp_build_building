import { describe, expect, it } from "vitest";
import { createB3dm } from "../src/lib/b3dm-writer.js";
import { createGlb } from "../src/lib/glb-writer.js";
import { buildExtrudedMesh } from "../src/lib/mesh-builder.js";

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
