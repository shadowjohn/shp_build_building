import proj4 from "proj4";

proj4.defs("EPSG:3826", "+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

export function twd97ToLonLat(x, y) {
  return proj4("EPSG:3826", "EPSG:4326", [Number(x), Number(y)]);
}

export function ringToLonLat(ring) {
  return ring.map(([x, y]) => twd97ToLonLat(x, y));
}
