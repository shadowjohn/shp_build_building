function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }

  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function stripOuterParens(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parsePolygon(wkt) {
  const match = wkt.trim().match(/^POLYGON(?:\s+Z)?\s*\(\s*(.*)\s*\)$/i);
  if (!match) return [];

  const ringsText = splitTopLevel(match[1].trim());
  return ringsText.map((ringText) => stripOuterParens(ringText)
    .split(",")
    .map((pair) => pair.trim().split(/\s+/).slice(0, 2).map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
}

export function parseBuildingWkt(wkt) {
  if (!wkt || typeof wkt !== "string") return [];

  const trimmed = wkt.trim();
  if (/^POLYGON/i.test(trimmed)) {
    const polygon = parsePolygon(trimmed);
    return polygon.length ? [polygon] : [];
  }

  if (/^GEOMETRYCOLLECTION/i.test(trimmed)) {
    const inner = trimmed.replace(/^GEOMETRYCOLLECTION(?:\s+Z)?\s*\(/i, "").replace(/\)$/, "");
    return splitTopLevel(inner).flatMap((part) => parseBuildingWkt(part));
  }

  return [];
}
