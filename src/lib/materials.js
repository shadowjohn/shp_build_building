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

  const type = classifyBuilding(building);
  const variant = Math.min(4, Math.floor(stableUnit(building.id) * 5));
  const n = variant / 4;
  const palettes = {
    lowrise: {
      wall: rgba(0.72 + n * 0.12, 0.70 + n * 0.10, 0.64 + n * 0.10, 1),
      roof: rgba(0.46 + n * 0.10, 0.23 + n * 0.08, 0.18 + n * 0.06, 1)
    },
    tower: {
      wall: rgba(0.48 + n * 0.10, 0.56 + n * 0.12, 0.62 + n * 0.12, 1),
      roof: rgba(0.24 + n * 0.08, 0.27 + n * 0.08, 0.30 + n * 0.08, 1)
    },
    large: {
      wall: rgba(0.58 + n * 0.10, 0.60 + n * 0.09, 0.57 + n * 0.08, 1),
      roof: rgba(0.30 + n * 0.12, 0.34 + n * 0.10, 0.36 + n * 0.08, 1)
    }
  };

  return {
    type,
    wall: { name: `${type}-wall-${variant}`, baseColorFactor: palettes[type].wall },
    roof: { name: `${type}-roof-${variant}`, baseColorFactor: palettes[type].roof }
  };
}
