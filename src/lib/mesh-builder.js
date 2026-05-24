import earcut from "earcut";
import { normalizeRing } from "./geometry.js";

export function buildExtrudedMesh(building) {
  const ring = normalizeRing(building.rings[0]);
  const positions = [];
  const indices = [];

  for (const [x, y] of ring) positions.push(x, y, 0);
  for (const [x, y] of ring) positions.push(x, y, building.heightMeters);

  const flat = ring.flatMap(([x, y]) => [x, y]);
  const top = earcut(flat);
  const topOffset = ring.length;
  for (let i = 0; i < top.length; i += 3) {
    indices.push(topOffset + top[i], topOffset + top[i + 1], topOffset + top[i + 2]);
  }

  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    const b0 = i;
    const b1 = j;
    const t0 = topOffset + i;
    const t1 = topOffset + j;
    indices.push(b0, b1, t1, b0, t1, t0);
  }

  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return {
    id: building.id,
    materialIndex: building.materialIndex,
    positions,
    indices,
    min: [Math.min(...xs), Math.min(...ys), 0],
    max: [Math.max(...xs), Math.max(...ys), building.heightMeters]
  };
}
