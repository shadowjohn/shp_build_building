# Input County Folder Names

將各縣市建物 SHP 或 SQLite DB 放在對應目錄下。目錄名稱建議使用下列英文 slug，保持小寫與底線。

| 中文縣市 | English slug |
|---|---|
| 臺北市 | taipei |
| 新北市 | newtaipei |
| 桃園市 | taoyuan |
| 臺中市 | taichung |
| 臺南市 | tainan |
| 高雄市 | kaohsiung |
| 基隆市 | keelung |
| 新竹市 | hsinchu_city |
| 嘉義市 | chiayi_city |
| 新竹縣 | hsinchu_county |
| 苗栗縣 | miaoli |
| 彰化縣 | changhua |
| 南投縣 | nantou |
| 雲林縣 | yunlin |
| 嘉義縣 | chiayi_county |
| 屏東縣 | pingtung |
| 宜蘭縣 | yilan |
| 花蓮縣 | hualien |
| 臺東縣 | taitung |
| 澎湖縣 | penghu |
| 金門縣 | kinmen |
| 連江縣 | lienchiang |

範例：

```text
input/
  taichung/
    8.shp
    8.shx
    8.dbf
    8.db
```

目前轉檔指令會用 `--county` 對應這裡的目錄名稱，例如：

```powershell
node src/build-taichung.js --county taichung --profile textured --height-mode terrain --edges --full --force
```
