export function normalizeRing(ring) {
  const clean = ring.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (clean.length > 1) {
    const first = clean[0];
    const last = clean.at(-1);
    if (first[0] === last[0] && first[1] === last[1]) {
      return clean.slice(0, -1);
    }
  }
  return clean;
}

export function computeAreaMeters(ring) {
  const clean = normalizeRing(ring);
  let sum = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const [x1, y1] = clean[i];
    const [x2, y2] = clean[(i + 1) % clean.length];
    sum += (x1 * y2) - (x2 * y1);
  }
  return Math.abs(sum) / 2;
}

export function computeBbox(ring) {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function computeCentroid(ring) {
  const clean = normalizeRing(ring);
  const sx = clean.reduce((sum, [x]) => sum + x, 0);
  const sy = clean.reduce((sum, [, y]) => sum + y, 0);
  return [sx / clean.length, sy / clean.length];
}

export function computeHeightMeters(floors, heightConfig) {
  const numeric = Number(floors);
  if (!Number.isFinite(numeric) || numeric <= 0) return heightConfig.fallbackMeters;
  return Math.min(numeric * heightConfig.floorMeters, heightConfig.maxMeters);
}
