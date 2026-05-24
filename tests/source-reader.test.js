import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeSourceToSqlite } from "../src/lib/shp-normalizer.js";
import { readBuildings } from "../src/lib/source-reader.js";

const tmpFiles = [];

function makeDb() {
  const fp = path.join(os.tmpdir(), `building-reader-${Date.now()}-${Math.random()}.db`);
  tmpFiles.push(fp);
  const db = new Database(fp);
  db.exec("CREATE TABLE building (ogc_fid INTEGER PRIMARY KEY, b1d INTEGER, b1b TEXT, b1c TEXT, GEOMETRY_WKT TEXT)");
  db.prepare("INSERT INTO building VALUES (?, ?, ?, ?, ?)").run(1, 2, "3", "3", "POLYGON((214990 2665060,215000 2665060,215000 2665070,214990 2665060))");
  db.prepare("INSERT INTO building VALUES (?, ?, ?, ?, ?)").run(2, 1, "3", "3", "POLYGON((195000 2600000,195010 2600000,195010 2600010,195000 2600000))");
  db.close();
  return fp;
}

afterEach(() => {
  for (const fp of tmpFiles.splice(0)) {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
});

describe("source reader", () => {
  it("reads rows with sample limit", () => {
    const sqlite = makeDb();
    const rows = [...readBuildings({ sqlite, table: "building", sample: 1 })];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
  });

  it("filters by WGS84 bbox using centroid conversion", () => {
    const sqlite = makeDb();
    const rows = [...readBuildings({ sqlite, table: "building", bbox: [120.5, 24.0, 120.8, 24.3] })];
    expect(rows.map((row) => row.id)).toEqual([1]);
  });
});

describe("shapefile normalizer", () => {
  it("returns sqlite source directly when input is already sqlite", () => {
    const source = normalizeSourceToSqlite({
      source: { kind: "sqlite", path: "input/taichung/8.db" },
      workDir: "cache/taichung",
      table: "8"
    });
    expect(source.sqlite).toBe("input/taichung/8.db");
    expect(source.table).toBe("8");
  });
});
