function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function rgba(r, g, b, a = 1) {
  return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
}

export function stableUnit(seed) {
  let x = Number(seed) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 10000) / 10000;
}

export function classifyBuilding(building) {
  if (building.heightMeters >= 60) return "tower";
  if (building.areaMeters >= 1800) return "large";
  return "lowrise";
}

export function createMaterialForBuilding(building) {
  if (building.profile === "white") {
    return {
      type: "white",
      wall: { name: "white-wall", baseColorFactor: rgba(0.92, 0.92, 0.90, 1) },
      roof: { name: "white-roof", baseColorFactor: rgba(0.82, 0.82, 0.80, 1) }
    };
  }

  if (building.profile === "height-debug") {
    const bucket = Math.min(5, Math.floor(building.heightMeters / 15));
    const t = bucket / 5;
    return {
      type: "height-debug",
      wall: { name: `height-debug-wall-${bucket}`, baseColorFactor: rgba(0.2 + t * 0.8, 0.8 - t * 0.5, 0.25, 1) },
      roof: { name: `height-debug-roof-${bucket}`, baseColorFactor: rgba(0.15 + t * 0.7, 0.25, 0.85 - t * 0.5, 1) }
    };
  }

  if (building.profile === "textured") {
    const styleIndex = Math.max(0, Math.floor(Number(building.textureStyleIndex) || 0));
    return {
      type: "textured",
      ground: { name: `textured-ground-${styleIndex}`, baseColorFactor: rgba(1, 1, 1, 1), texture: { kind: "ground", styleIndex } },
      wall: { name: `textured-wall-${styleIndex}`, baseColorFactor: rgba(1, 1, 1, 1), texture: { kind: "wall", styleIndex } },
      roof: { name: `textured-roof-${styleIndex}`, baseColorFactor: rgba(1, 1, 1, 1), texture: { kind: "roof", styleIndex } }
    };
  }

  const type = classifyBuilding(building);
  const variant = Math.min(4, Math.floor(stableUnit(building.id) * 5));
  const n = variant / 4;
  const palettes = {
    lowrise: {
      wall: rgba(0.50 + n * 0.12, 0.49 + n * 0.10, 0.45 + n * 0.10, 0.88),
      roof: rgba(0.34 + n * 0.08, 0.24 + n * 0.06, 0.21 + n * 0.05, 0.92)
    },
    tower: {
      wall: rgba(0.36 + n * 0.08, 0.45 + n * 0.10, 0.54 + n * 0.10, 0.90),
      roof: rgba(0.20 + n * 0.06, 0.24 + n * 0.06, 0.30 + n * 0.06, 0.94)
    },
    large: {
      wall: rgba(0.43 + n * 0.10, 0.45 + n * 0.08, 0.42 + n * 0.08, 0.88),
      roof: rgba(0.25 + n * 0.10, 0.30 + n * 0.08, 0.33 + n * 0.06, 0.94)
    }
  };

  return {
    type,
    wall: { name: `${type}-wall-${variant}`, baseColorFactor: palettes[type].wall },
    roof: { name: `${type}-roof-${variant}`, baseColorFactor: palettes[type].roof }
  };
}
