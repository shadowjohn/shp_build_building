import { describe, expect, it } from "vitest";
import { createB3dm } from "../src/lib/b3dm-writer.js";
import { createGlb } from "../src/lib/glb-writer.js";
import { buildExtrudedMesh } from "../src/lib/mesh-builder.js";

function glbJson(glb) {
  const jsonLength = glb.readUInt32LE(12);
  return JSON.parse(glb.slice(20, 20 + jsonLength).toString("utf8").trim());
}

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

  it("supports terrain base height and optional outline indices", () => {
    const mesh = buildExtrudedMesh({
      id: 1,
      rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
      heightMeters: 6.6,
      baseHeightMeters: 80,
      materialIndex: 0,
      lineMaterialIndex: 1,
      outline: true
    });
    expect(mesh.min[2]).toBe(80);
    expect(mesh.max[2]).toBe(86.6);
    expect(mesh.lineMaterialIndex).toBe(1);
    expect(mesh.lineIndices.length).toBeGreaterThan(0);
  });

  it("scales textured wall UVs by floor height", () => {
    const mesh = buildExtrudedMesh({
      id: 1,
      rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
      heightMeters: 13.2,
      materialIndex: 0,
      textureScaleXMeters: 42,
      floorHeightMeters: 3.3,
      floorsPerTexture: 4
    });
    const firstTopVertexV = mesh.texcoords[(4 * 2) + 1];
    expect(firstTopVertexV).toBeCloseTo(1);
  });

  it("splits first floor facade from upper wall when a ground material is provided", () => {
    const mesh = buildExtrudedMesh({
      id: 1,
      rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
      heightMeters: 13.2,
      materialIndex: 1,
      groundMaterialIndex: 0,
      roofMaterialIndex: 2,
      groundFloorHeightMeters: 3.3,
      floorHeightMeters: 3.3,
      floorsPerTexture: 4
    });
    expect(mesh.groundMaterialIndex).toBe(0);
    expect(mesh.groundIndices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.roofIndices.length).toBeGreaterThan(0);
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

  it("groups meshes with the same material into one primitive", () => {
    const meshes = [1, 2].map((id) => buildExtrudedMesh({
      id,
      rings: [[[id * 20, 0], [id * 20 + 10, 0], [id * 20 + 10, 10], [id * 20, 10]]],
      heightMeters: 6.6,
      materialIndex: 0
    }));
    const glb = createGlb({
      meshes,
      materials: [{ name: "wall", baseColorFactor: [1, 1, 1, 1] }]
    });
    expect(glbJson(glb).meshes[0].primitives).toHaveLength(1);
  });

  it("writes double-sided materials for Cesium wall viewing angles", () => {
    const glb = createGlb({
      meshes: [buildExtrudedMesh({
        id: 1,
        rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
        heightMeters: 6.6,
        materialIndex: 0
      })],
      materials: [{ name: "wall", baseColorFactor: [1, 1, 1, 1] }]
    });
    expect(glbJson(glb).materials[0].doubleSided).toBe(true);
  });

  it("writes blend mode for translucent outline materials", () => {
    const glb = createGlb({
      meshes: [buildExtrudedMesh({
        id: 1,
        rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
        heightMeters: 6.6,
        materialIndex: 0
      })],
      materials: [{ name: "outline", baseColorFactor: [0, 0, 0, 0.32] }]
    });
    expect(glbJson(glb).materials[0].alphaMode).toBe("BLEND");
  });

  it("writes outline line primitives when meshes include line indices", () => {
    const glb = createGlb({
      meshes: [buildExtrudedMesh({
        id: 1,
        rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
        heightMeters: 6.6,
        materialIndex: 0,
        lineMaterialIndex: 1,
        outline: true
      })],
      materials: [
        { name: "wall", baseColorFactor: [1, 1, 1, 1] },
        { name: "edge", baseColorFactor: [0, 0, 0, 1] }
      ]
    });
    const primitives = glbJson(glb).meshes[0].primitives;
    expect(primitives.some((primitive) => primitive.mode === 1)).toBe(true);
    expect(primitives.some((primitive) => primitive.mode === 4)).toBe(true);
  });

  it("writes textured materials and texture coordinates", () => {
    const glb = createGlb({
      meshes: [buildExtrudedMesh({
        id: 1,
        rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
        heightMeters: 9.9,
        materialIndex: 0,
        roofMaterialIndex: 1
      })],
      materials: [
        { name: "wall-texture", baseColorFactor: [1, 1, 1, 1], texture: { kind: "wall", styleIndex: 0 } },
        { name: "roof-texture", baseColorFactor: [1, 1, 1, 1], texture: { kind: "roof", styleIndex: 0 } }
      ]
    });
    const json = glbJson(glb);
    expect(json.textures).toHaveLength(2);
    expect(json.images).toHaveLength(2);
    expect(json.materials[0].pbrMetallicRoughness.baseColorTexture.index).toBe(0);
    expect(json.meshes[0].primitives[0].attributes.TEXCOORD_0).toBe(1);
  });
});
