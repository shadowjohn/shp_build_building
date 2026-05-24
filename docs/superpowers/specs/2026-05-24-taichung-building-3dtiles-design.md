# Taichung Building 3D Tiles MVP Design

## Goal

Build a small offline batch tool under `D:\mytools\shp_build_building` that converts county-separated building SHP/SQLite data into Cesium-compatible 3D Tiles tilesets.

The MVP prioritizes:

- a simple `input/` folder where county folders can be dropped in
- full-city offline output, starting with Taichung
- per-county output under `output/<county>/<profile>/`
- multiple output profiles from the same source geometry
- visible building height differences
- city-like procedural materials
- repeatable batch runs with logs and manifests
- compatibility with existing Easymap/Cesium terrain workflows

The MVP does not attempt photo-real facade texturing. Real image-based textures can be a later phase after the 3D Tiles pipeline is stable.

## Source Data

Primary Taichung building source:

- `Z:\easymap_server\uploads\8\8.db`
- `Z:\easymap_server\uploads\8\8.shp`
- `Z:\easymap_server\uploads\8\8.dbf`
- `Z:\easymap_server\uploads\8\8.shx`

The working tool should use this local input convention:

```text
input/
  taichung/
    8.shp
    8.shx
    8.dbf
    8.db
  changhua/
    *.shp
    *.shx
    *.dbf
```

Each direct child folder of `input/` is treated as one county key. A county folder may contain either a SQLite/SpatiaLite `.db` with `GEOMETRY_WKT`, or a shapefile set. Taichung is the first implementation target; the layout should not hard-code Taichung-only assumptions.

GDAL tools should be called from the fixed local install path:

```text
C:\ms4w_MSSQL\GDAL
```

Use full executable paths such as `C:\ms4w_MSSQL\GDAL\ogr2ogr.exe` and `C:\ms4w_MSSQL\GDAL\ogrinfo.exe` rather than relying on `PATH`.

Observed data facts:

- Feature count: `883592`
- Geometry type: `3D Polygon`
- Sample Z values are `0`, so geometry Z is not treated as building height.
- SHP SRS is not declared.
- Extent matches Taiwan TWD97 TM2 zone 121, so the MVP treats input coordinates as `EPSG:3826`.
- Useful fields:
  - `b1a`: 圖名代碼
  - `b1b`: 房屋型態碼
  - `b1c`: 房屋結構碼
  - `b1d`: 建物樓層數
  - `b1e`: 更新年度
  - `b1f`: 備註

Existing terrain source:

- `D:\mytools\dem20M_terrain`
- Existing published terrain target is expected to follow the terrain project convention, for example `/data/terrain20M/taichung`.

## Existing Prototype Reference

The existing prototype at `https://3wa.tw/demo/htm/test_javascript.php?id=365` is used as a behavioral reference, not as the final architecture.

Its useful parts:

- Opens Easymap 3D.
- Uses `identity.php?mode=identity&wms_id=8&lon=...&lat=...&limit=2000` to load nearby buildings dynamically.
- Extrudes Cesium Entity polygons with `height = 0` and `extrudedHeight = 3.3 * b1d`.
- Uses entity deduplication and removes older entities when the count grows.
- Provides a good visual baseline for local spot checks.

Reason not to use it as the final MVP architecture:

- Dynamic Cesium Entities are useful for a local demo but do not scale well to a full-city persistent building layer.
- Offline 3D Tiles are better for full-city loading, culling, caching, and future publication.

## MVP Architecture

The tool is a local CLI pipeline:

```text
inspect input
  -> normalize geometry and attributes
  -> transform EPSG:3826 to WGS84/ECEF
  -> split buildings into spatial batches
  -> extrude footprints into meshes
  -> apply procedural materials
  -> write 3D Tiles output
  -> write manifest and logs
  -> verify in local viewer
```

The implementation should stay dependency-light but can use proven geospatial and 3D tools already present on the machine, especially GDAL/OGR for input inspection and conversion.

## Height Strategy

MVP height formula:

```text
height_m = b1d * 3.3
```

Rules:

- If `b1d` is missing, zero, negative, or unreasonable, use a conservative fallback height.
- Initial fallback is one floor, `3.3m`.
- Clamp unreasonable values to a configured maximum to avoid bad spikes.
- Store the original `b1d` and computed height in batch metadata where practical.

Terrain height is not baked into each building in MVP. The first version focuses on a stable full-city tileset. Terrain sampling can be added later after output correctness and performance are verified.

## Procedural Material Strategy

The MVP supports output profiles. Each profile creates its own `tileset.json` using the same input geometry and height rules.

Recommended profiles:

- `white`: plain white/gray model for planning, overlay, printing, and performance checks.
- `procedural`: default city-like material profile with deterministic wall and roof colors.
- `height-debug`: diagnostic profile that colors buildings by floor count or computed height.
- `textured`: reserved profile name for future real facade or generated texture work.

The first production-looking MVP profile is `procedural`, which uses procedural materials rather than real photo textures.

Material inputs:

- floor count
- footprint area
- `b1b` building type code
- `b1c` structure code
- stable random seed derived from feature id

Wall material goals:

- Low-rise residential buildings should use light neutral colors with subtle variation.
- Tall buildings should be visually distinct and slightly cooler/darker.
- Large-footprint buildings can use industrial or public-building palettes.
- Window-grid texture or UV pattern should make facades read as buildings instead of plain blocks.

Roof material goals:

- Roofs should use a different palette from walls.
- Roof color should vary by stable seed and area.
- The rule should be deterministic so re-running the same input produces the same visual result.

The first material set can be procedural texture images generated locally, for example small repeatable PNGs for walls, windows, and roofs. A later phase can replace or expand this with better texture atlases.

## 3D Tiles Output

Output should be written under a stable local folder, for example:

```text
output/
  taichung/
    white/
      tileset.json
      manifest.json
      logs/
      tiles/
    procedural/
      tileset.json
      manifest.json
      logs/
      tiles/
    height-debug/
      tileset.json
      manifest.json
      logs/
      tiles/
```

The exact internal tile layout can be adjusted during implementation, but the public entry point should be `output/<county>/<profile>/tileset.json`.

The output should support:

- full-city loading in Cesium
- spatial culling
- repeatable rebuilds
- resumable or at least safe reruns
- clear manifest information

Manifest should include:

- source file paths
- county key
- profile key
- source feature count
- source SRS assumption
- height formula
- fallback height rules
- material rule version
- build start/end timestamps
- tile count and approximate feature count per tile
- tool versions where available

## Viewer Verification

The MVP should include a local viewer for verification.

Viewer expectations:

- Load terrain from existing terrain output when available.
- Load `output/taichung/tileset.json`.
- Start camera near Taichung urban area.
- Provide enough status text to show terrain and tileset load success or failure.
- Use existing 3WA Cesium/Easymap conventions where practical.

The viewer is an acceptance tool, not the production UI.

## Error Handling And Logging

The batch tool should fail loudly for:

- missing source files
- unreadable SQLite/SHP input
- unsupported or empty geometry
- missing required floor field
- failed coordinate transform
- failed tileset write

The tool should skip and count individual bad features when safe, but the final manifest must report skipped counts and reasons.

Logs should be useful for long runs:

- start/end time
- input summary
- batch progress
- warning counts
- output summary

## Testing And Validation

Minimum validation for MVP:

- inspect input schema and feature count
- generate a small sample tileset first
- verify full pipeline on a limited bounding box before full Taichung
- verify `white`, `procedural`, and `height-debug` outputs each have `tileset.json`
- open local viewer and confirm buildings appear at the right Taichung location
- compare at least one location with the existing id=365 prototype height behavior

## Deferred Work

Deferred until after MVP:

- real photo facade texturing
- baked terrain height per building
- LOD2 roof forms
- per-building metadata query UI
- full all-Taiwan county automation beyond the input/output convention
- server-side publishing workflow
