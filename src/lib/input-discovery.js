import fs from "node:fs";
import path from "node:path";

export function resolveCountySource({ county, files }) {
  const db = files.find((file) => file.toLowerCase().endsWith(".db"));
  if (db) return { county, kind: "sqlite", file: db };

  const shp = files.find((file) => file.toLowerCase().endsWith(".shp"));
  if (shp) return { county, kind: "shp", file: shp };

  throw new Error(`No .db or .shp found for county: ${county}`);
}

export function discoverCountySource(countyDir, county) {
  try {
    fs.lstatSync(countyDir);
  } catch {
    throw new Error(`County input folder not found: ${countyDir}`);
  }

  const files = fs.readdirSync(countyDir);
  const source = resolveCountySource({ county, files });
  source.path = path.join(countyDir, source.file);
  return source;
}
