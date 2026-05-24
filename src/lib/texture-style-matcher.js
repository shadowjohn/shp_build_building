import { styleRoofColor, TEXTURE_STYLE_COUNT } from "./texture-generator.js";

function distanceSq(a, b) {
  const dr = a.r - b[0];
  const dg = a.g - b[1];
  const db = a.b - b[2];
  return dr * dr + dg * dg + db * db;
}

export function matchRoofStyle(sample) {
  if (!sample) return 0;
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < TEXTURE_STYLE_COUNT; i += 1) {
    const d = distanceSq(sample, styleRoofColor(i));
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  }
  return best;
}
