# shp_build_building

將縣市建物 SHP / SQLite DB 批次轉成 Cesium 3D Tiles，目標是讓全臺建物可以離線產製、穩定重跑、快速發布，並能依需求切換白模、程序化材質、貼皮材質與是否貼地形。

目前 MVP 先完成臺中、桃園、新北三個縣市，後續縣市只要把資料放進 `input/<county>/`，再指定 `--county` 重跑即可。

## 產出

- 輸入資料：`input/<county>/`
- 轉檔成果：`output/<county>/<variant>/`
- 主要入口：`output/<county>/<variant>/tileset.json`
- Viewer：`demo.html` 與 `viewer/`

`variant` 由材質、地形模式與邊線組成，例如：

```text
output/taichung/textured-terrain-edges/
output/taichung/textured-height0-edges/
output/taichung/white-terrain-edges/
output/taichung/white-height0-edges/
```

大型來源資料、cache 與 3D Tiles 成果不簽入版控；版控只追蹤程式、測試、viewer、文件與 input 目錄說明。

## 目前定版

2026-05-25 這版先以 Easymap / OL-Cesium demo 實測為可用基準。

- `taichung`：臺中市，已產 `textured-terrain-edges`、`textured-height0-edges`、`white-terrain-edges`、`white-height0-edges`。
- `taoyuan`：桃園市，已產 `textured-terrain-edges`、`white-terrain-edges`。
- `newtaipei`：新北市，已產 `textured-terrain-edges`、`white-terrain-edges`。

展示頁預設建議使用 `textured-terrain-edges`。這套風格是淡灰白程序化貼皮，包含樓層 repeat、屋頂材質、低調邊線與地形貼合，視覺上比純白模更容易辨識街廓與樓高。

## 資料目錄

縣市建物資料放在：

```text
input/
  taichung/
  taoyuan/
  newtaipei/
```

每個縣市目錄可放 SHP sidecar 或 SQLite DB。縣市中英文 slug 對照請看 `input/README.md`。

```powershell
node src/build-taichung.js --county taichung --profile textured --height-mode terrain --edges --full --force
```

若 SQLite table 名稱不是預設值，可用 `--table` 指定：

```powershell
node src/build-taichung.js --county taoyuan --table 8420 --profile textured --height-mode terrain --edges --full --force
```

## 必要工具

- Node.js
- GDAL
- SQLite 讀取套件由 `npm ci` 安裝

GDAL 可使用 [shadowjohn/ms4w_MSSQL](https://github.com/shadowjohn/ms4w_MSSQL) 這套 MS4W / GDAL 環境。專案預設會優先嘗試 `C:\ms4w_MSSQL\GDAL` 內的 GDAL 工具；若環境不同，可透過 PATH 或參數指定。

Terrain 採樣需要已轉好的 DEM / GeoTIFF 工作成果。文件與命令範例只使用占位路徑，正式環境請以 `--terrain-root <terrain-work-root>` 指到 terrain 專案的 work raster 位置。

## 安裝與檢查

```powershell
npm ci
npm test
npm run check
```

啟動本機 demo：

```powershell
npm run serve:viewer
```

然後開啟：

```text
http://localhost:8088/demo.html
```

## 常用產製命令

臺中完整貼地形貼皮：

```powershell
npm run build:taichung:textured:terrain
```

臺中 height 0 貼皮：

```powershell
npm run build:taichung:textured:height0
```

臺中白模貼地形：

```powershell
npm run build:taichung:white
```

臺中白模 height 0：

```powershell
npm run build:taichung:white:height0
```

桃園：

```powershell
npm run build:taoyuan:textured:terrain
npm run build:taoyuan:white:terrain
```

新北：

```powershell
npm run build:newtaipei:textured:terrain
npm run build:newtaipei:white:terrain
```

小範圍測試：

```powershell
node src/build-taichung.js --county taichung --profile textured --height-mode terrain --edges --bbox 120.64,24.08,120.69,24.12 --force
```

抽樣測試：

```powershell
node src/build-taichung.js --county taichung --profile textured --height-mode height0 --edges --sample 200 --force
```

## CLI 參數

| 參數 | 用途 |
|---|---|
| `--county <slug>` | 指定縣市目錄，例如 `taichung`、`taoyuan`、`newtaipei` |
| `--table <name>` | 指定 SQLite table 或來源代號 |
| `--profile <name>` | `white`、`procedural`、`height-debug`、`textured` |
| `--height-mode <mode>` | `terrain` 會採 terrain 高程，`height0` 會以 0 高程出磚 |
| `--edges` | 產出建物邊線 |
| `--full` | 全量處理 |
| `--sample <n>` | 只取前 n 筆，方便快速測試 |
| `--bbox minLon,minLat,maxLon,maxLat` | 只處理指定範圍 |
| `--force` | 覆蓋既有輸出 |
| `--out <dir>` | 改指定輸出根目錄 |
| `--terrain-root <dir>` | 指定 terrain work raster 根目錄 |

## 貼皮策略

`textured` 目前採程序化貼皮，目標是「像城市、清楚、不糊、可穩定重跑」：

1. 依建物 footprint、樓高、面積與穩定 seed 選擇材質。
2. 牆面分成一樓與上層樓層；一樓有騎樓、門面、入口等變化，上層依樓層高度 repeat。
3. 屋頂使用淡灰白低對比樣式，避免斜線或橫線過度搶視覺。
4. 邊線採低調顏色，讓街廓與量體清楚，但不蓋過貼皮。

後續若要從航照圖找相近樣式，請走 cache-first 流程：同一區塊航照圖重複使用，避免大量重複抓圖。預設不主動下載線上影像；若要開啟受控下載，請限制張數與延遲：

```powershell
node src/build-taichung.js --county taichung --profile textured --height-mode terrain --edges --full --download-imagery 200 --imagery-delay-ms 500
```

## 發布

正式發布建議放到站台的：

```text
/data/3D/buildings/<county>/<variant>/
```

例如：

```text
/data/3D/buildings/taichung/textured-terrain-edges/tileset.json
/data/3D/buildings/taoyuan/white-terrain-edges/tileset.json
```

不要把站台實體磁碟、上傳暫存目錄或來源資料目錄寫進版控文件；部署腳本可在各環境自行保存。

## Easymap Demo

展示頁可參考：

```text
/demo/htm/map/3D/building_demo/
```

Demo 使用 3WA Easymap CDN、全臺含外島 terrain、縣市建物開關、兩種有地形樣式與 3D Tiles 透明度控制。前端 URL 以站台路徑為主：

```text
https://3wa.tw/data/terrain20M/all_taiwan
https://3wa.tw/data/3D/buildings/<county>/<variant>/tileset.json
```

## 與 dem20M_terrain 的關係

本專案只負責建物 3D Tiles。Terrain 來源與產線請參考 [shadowjohn/dem20M_terrain](https://github.com/shadowjohn/dem20M_terrain)。

建物貼地形時會用 terrain 專案產出的 work raster 做高程採樣；前端顯示則載入 terrain provider。兩邊要使用同一套 terrain 基準，避免建物看起來浮起或插入地面。

## 驗證重點

每次調整建議至少跑：

```powershell
npm test
npm run check
```

若有改 tileset / GLB / 材質：

1. 先用 `--sample` 或 `--bbox` 小範圍出磚。
2. 用 `demo.html` 檢查建物高度、貼地、透明度、邊線與材質。
3. 再跑全量產製與發布。

## 版控規則

`.gitignore` 已排除：

- `input/<county>/` 內的來源資料
- `output/`
- `cache/`
- `node_modules/`
- SHP、SQLite、GeoTIFF、terrain、b3dm、glb、壓縮檔等大型成果

若新增縣市，只提交程式與文件，不提交來源建物資料與轉檔成果。
