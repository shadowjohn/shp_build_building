import Database from "better-sqlite3";
import { computeCentroid } from "./geometry.js";
import { ringToTwd97, twd97ToLonLat } from "./projection.js";
import { parseBuildingWkt } from "./wkt.js";

function insideBbox(lonLat, bbox) {
  if (!bbox) return true;
  const [lon, lat] = lonLat;
  return lon >= bbox[0] && lat >= bbox[1] && lon <= bbox[2] && lat <= bbox[3];
}

function looksLikeLonLat(point) {
  const [x, y] = point;
  return x >= 100 && x <= 130 && y >= 20 && y <= 30;
}

function normalizePolygons(polygons) {
  const first = polygons[0]?.[0]?.[0];
  if (!first) return polygons;
  if (!looksLikeLonLat(first)) return polygons;
  return polygons.map((polygon) => [ringToTwd97(polygon[0]), ...polygon.slice(1).map((ring) => ringToTwd97(ring))]);
}

function tableColumns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name));
}

function firstColumn(columns, names) {
  return names.find((name) => columns.has(name));
}

function fieldExpr(columns, names, alias) {
  const column = firstColumn(columns, names);
  return column ? `"${column}" AS "${alias}"` : `NULL AS "${alias}"`;
}

export function* readBuildings(options) {
  const db = new Database(options.sqlite, { readonly: true, fileMustExist: true });
  const table = options.table;
  const columns = tableColumns(db, table);
  const limit = options.sample ? ` LIMIT ${Number(options.sample)}` : "";
  const idColumn = firstColumn(columns, ["ogc_fid", "fid", "id"]) || "rowid";
  const geometryColumn = firstColumn(columns, ["GEOMETRY_WKT", "geometry_wkt", "WKT"]);
  if (!geometryColumn) {
    db.close();
    throw new Error(`Table ${table} has no GEOMETRY_WKT column`);
  }
  const sql = [
    `SELECT "${idColumn}" AS "ogc_fid"`,
    fieldExpr(columns, ["b1d", "build_no"], "floors"),
    fieldExpr(columns, ["build_h", "height", "height_m"], "heightMeters"),
    fieldExpr(columns, ["b1b", "buildtype"], "b1b"),
    fieldExpr(columns, ["b1c", "build_str"], "b1c"),
    `"${geometryColumn}" AS "GEOMETRY_WKT"`,
    `FROM "${table}" ORDER BY "${idColumn}"${limit}`
  ].join(", ").replace(", FROM", " FROM");

  try {
    for (const row of db.prepare(sql).iterate()) {
      const polygons = normalizePolygons(parseBuildingWkt(row.GEOMETRY_WKT));
      if (!polygons.length || !polygons[0].length || polygons[0][0].length < 3) continue;

      const centroid = computeCentroid(polygons[0][0]);
      const lonLat = twd97ToLonLat(centroid[0], centroid[1]);
      if (!insideBbox(lonLat, options.bbox)) continue;

      yield {
        id: row.ogc_fid,
        floors: row.floors,
        heightMeters: row.heightMeters,
        b1b: row.b1b,
        b1c: row.b1c,
        polygons,
        centroid,
        lonLat
      };
    }
  } finally {
    db.close();
  }
}
