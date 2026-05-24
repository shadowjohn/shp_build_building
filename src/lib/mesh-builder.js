import earcut from "earcut";
import { normalizeRing } from "./geometry.js";

export function buildExtrudedMesh(building) {
  const ring = normalizeRing(building.rings[0]);
  const positions = [];
  const texcoords = [];
  const indices = [];
  const groundIndices = [];
  const roofIndices = [];
  const lineIndices = [];
  const baseHeight = building.baseHeightMeters ?? 0;
  const topHeight = baseHeight + building.heightMeters;
  const groundHeight = building.groundMaterialIndex !== undefined
    ? Math.min(building.heightMeters, building.groundFloorHeightMeters ?? 3.3)
    : 0;
  const groundTopHeight = baseHeight + groundHeight;
  const hasGroundBand = building.groundMaterialIndex !== undefined && groundHeight > 0 && building.heightMeters > groundHeight + 0.2;
  const textureScaleX = building.textureScaleXMeters ?? building.textureScaleMeters ?? 24;
  const textureScaleY = building.textureScaleYMeters ??
    ((building.floorHeightMeters && building.floorsPerTexture)
      ? building.floorHeightMeters * building.floorsPerTexture
      : textureScaleX);

  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const depth = Math.max(1, maxY - minY);

  for (const [x, y] of ring) {
    positions.push(x, y, baseHeight);
    texcoords.push((x - minX) / textureScaleX, 0);
  }
  let upperBaseOffset = 0;
  if (hasGroundBand) {
    upperBaseOffset = ring.length;
    for (const [x, y] of ring) {
      positions.push(x, y, groundTopHeight);
      texcoords.push((x - minX) / textureScaleX, 1);
    }
  }
  const topOffset = positions.length / 3;
  for (const [x, y] of ring) {
    positions.push(x, y, topHeight);
    texcoords.push((x - minX) / textureScaleX, (building.heightMeters - groundHeight) / textureScaleY);
  }
  const roofOffset = positions.length / 3;
  for (const [x, y] of ring) {
    positions.push(x, y, topHeight);
    texcoords.push((x - minX) / width, (y - minY) / depth);
  }

  const flat = ring.flatMap(([x, y]) => [x, y]);
  const top = earcut(flat);
  for (let i = 0; i < top.length; i += 3) {
    roofIndices.push(roofOffset + top[i], roofOffset + top[i + 1], roofOffset + top[i + 2]);
  }

  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    const b0 = i;
    const b1 = j;
    const t0 = topOffset + i;
    const t1 = topOffset + j;
    if (hasGroundBand) {
      const g0 = upperBaseOffset + i;
      const g1 = upperBaseOffset + j;
      groundIndices.push(b0, b1, g1, b0, g1, g0);
      indices.push(g0, g1, t1, g0, t1, t0);
    } else {
      indices.push(b0, b1, t1, b0, t1, t0);
    }
    if (building.outline) {
      lineIndices.push(b0, t0, t0, t1);
    }
  }

  return {
    id: building.id,
    groundMaterialIndex: building.groundMaterialIndex,
    materialIndex: building.materialIndex,
    roofMaterialIndex: building.roofMaterialIndex ?? building.materialIndex,
    lineMaterialIndex: building.lineMaterialIndex,
    positions,
    texcoords,
    groundIndices,
    indices,
    roofIndices,
    lineIndices,
    min: [Math.min(...xs), Math.min(...ys), baseHeight],
    max: [Math.max(...xs), Math.max(...ys), topHeight]
  };
}
