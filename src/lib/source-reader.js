import Database from "better-sqlite3";
import { computeCentroid } from "./geometry.js";
import { twd97ToLonLat } from "./projection.js";
import { parseBuildingWkt } from "./wkt.js";

function insideBbox(lonLat, bbox) {
  if (!bbox) return true;
  const [lon, lat] = lonLat;
  return lon >= bbox[0] && lat >= bbox[1] && lon <= bbox[2] && lat <= bbox[3];
}

export function* readBuildings(options) {
  const db = new Database(options.sqlite, { readonly: true, fileMustExist: true });
  const table = options.table;
  const limit = options.sample ? ` LIMIT ${Number(options.sample)}` : "";
  const sql = `SELECT ogc_fid, b1d, b1b, b1c, GEOMETRY_WKT FROM "${table}" ORDER BY ogc_fid${limit}`;

  try {
    for (const row of db.prepare(sql).iterate()) {
      const polygons = parseBuildingWkt(row.GEOMETRY_WKT);
      if (!polygons.length || !polygons[0].length || polygons[0][0].length < 3) continue;

      const centroid = computeCentroid(polygons[0][0]);
      const lonLat = twd97ToLonLat(centroid[0], centroid[1]);
      if (!insideBbox(lonLat, options.bbox)) continue;

      yield {
        id: row.ogc_fid,
        floors: row.b1d,
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
