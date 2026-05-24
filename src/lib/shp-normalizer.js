import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function normalizeSourceToSqlite({ source, workDir, table, ogr2ogr = "C:\\ms4w_MSSQL\\GDAL\\ogr2ogr.exe" }) {
  if (source.kind === "sqlite") {
    return { sqlite: source.path, table };
  }

  if (source.kind !== "shp") {
    throw new Error(`Unsupported source kind: ${source.kind}`);
  }

  fs.mkdirSync(workDir, { recursive: true });
  const sqlite = path.join(workDir, `${source.county}.sqlite`);
  fs.rmSync(sqlite, { force: true });

  const layerName = path.basename(source.path, ".shp");
  execFileSync(ogr2ogr, [
    "-f", "SQLite",
    "-lco", "GEOMETRY_NAME=GEOMETRY",
    "-dialect", "SQLite",
    "-sql", `SELECT *, ST_AsText(geometry) AS GEOMETRY_WKT FROM "${layerName}"`,
    sqlite,
    source.path,
    "-nln", table
  ], { stdio: "inherit" });

  return { sqlite, table };
}
