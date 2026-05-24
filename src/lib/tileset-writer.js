import fs from "node:fs";
import path from "node:path";

function rad(deg) {
  return deg * Math.PI / 180;
}

function toRegionRadians(region) {
  return [rad(region[0]), rad(region[1]), rad(region[2]), rad(region[3]), region[4], region[5]];
}

function unionRegion(tiles) {
  return [
    Math.min(...tiles.map((tile) => tile.region[0])),
    Math.min(...tiles.map((tile) => tile.region[1])),
    Math.max(...tiles.map((tile) => tile.region[2])),
    Math.max(...tiles.map((tile) => tile.region[3])),
    Math.min(...tiles.map((tile) => tile.region[4])),
    Math.max(...tiles.map((tile) => tile.region[5]))
  ];
}

function groupKey(tileId, parentGridTiles) {
  const [gx, gy] = tileId.split("_").map(Number);
  return `${Math.floor(gx / parentGridTiles)}_${Math.floor(gy / parentGridTiles)}`;
}

function groupTiles(tiles, parentGridTiles) {
  const groups = new Map();
  for (const tile of tiles) {
    const key = groupKey(tile.id, parentGridTiles);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tile);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
}

export function writeTileset({ outputRoot, sourceSummary, tiles, tiling = {} }) {
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.rmSync(path.join(outputRoot, "tiles"), { recursive: true, force: true });
  fs.rmSync(path.join(outputRoot, "tileset.json"), { force: true });
  fs.rmSync(path.join(outputRoot, "manifest.json"), { force: true });
  fs.mkdirSync(path.join(outputRoot, "tiles"), { recursive: true });

  for (const tile of tiles) {
    fs.writeFileSync(path.join(outputRoot, "tiles", `${tile.id}.b3dm`), tile.content);
  }

  const parentGridTiles = tiling.parentGridTiles ?? 4;
  const geometricErrorRoot = tiling.geometricErrorRoot ?? 500;
  const geometricErrorParent = tiling.geometricErrorParent ?? 180;
  const geometricErrorTile = tiling.geometricErrorTile ?? 80;
  const groupedTiles = groupTiles(tiles, parentGridTiles);
  const rootRegion = unionRegion(tiles);
  const tileset = {
    asset: { version: "1.0", generator: "shp_build_building", gltfUpAxis: "Z" },
    geometricError: geometricErrorRoot,
    root: {
      boundingVolume: { region: toRegionRadians(rootRegion) },
      geometricError: geometricErrorParent,
      refine: "ADD",
      children: groupedTiles.map(([id, group]) => ({
        boundingVolume: { region: toRegionRadians(unionRegion(group)) },
        geometricError: geometricErrorParent,
        refine: "ADD",
        extras: { id, tileCount: group.length },
        children: group.map((tile) => ({
          boundingVolume: { region: toRegionRadians(tile.region) },
          geometricError: geometricErrorTile,
          content: { uri: `tiles/${tile.id}.b3dm` },
          refine: "ADD",
          ...(tile.transform ? { transform: tile.transform } : {})
        }))
      }))
    }
  };

  fs.writeFileSync(path.join(outputRoot, "tileset.json"), JSON.stringify(tileset, null, 2), "utf8");
  fs.writeFileSync(path.join(outputRoot, "manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: sourceSummary,
    tileCount: tiles.length,
    parentTileCount: groupedTiles.length,
    featureCount: tiles.reduce((sum, tile) => sum + tile.featureCount, 0)
  }, null, 2), "utf8");
}
