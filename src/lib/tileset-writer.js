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

export function writeTileset({ outputRoot, sourceSummary, tiles }) {
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.rmSync(path.join(outputRoot, "tiles"), { recursive: true, force: true });
  fs.rmSync(path.join(outputRoot, "tileset.json"), { force: true });
  fs.rmSync(path.join(outputRoot, "manifest.json"), { force: true });
  fs.mkdirSync(path.join(outputRoot, "tiles"), { recursive: true });

  for (const tile of tiles) {
    fs.writeFileSync(path.join(outputRoot, "tiles", `${tile.id}.b3dm`), tile.content);
  }

  const rootRegion = unionRegion(tiles);
  const tileset = {
    asset: { version: "1.0", generator: "shp_build_building", gltfUpAxis: "Z" },
    geometricError: 500,
    root: {
      boundingVolume: { region: toRegionRadians(rootRegion) },
      geometricError: 250,
      refine: "ADD",
      children: tiles.map((tile) => ({
        boundingVolume: { region: toRegionRadians(tile.region) },
        geometricError: 40,
        content: { uri: `tiles/${tile.id}.b3dm` },
        refine: "ADD",
        ...(tile.transform ? { transform: tile.transform } : {})
      }))
    }
  };

  fs.writeFileSync(path.join(outputRoot, "tileset.json"), JSON.stringify(tileset, null, 2), "utf8");
  fs.writeFileSync(path.join(outputRoot, "manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: sourceSummary,
    tileCount: tiles.length,
    featureCount: tiles.reduce((sum, tile) => sum + tile.featureCount, 0)
  }, null, 2), "utf8");
}
