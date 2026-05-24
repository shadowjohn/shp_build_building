import proj4 from "proj4";

proj4.defs("EPSG:3826", "+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

export function twd97ToLonLat(x, y) {
  return proj4("EPSG:3826", "EPSG:4326", [Number(x), Number(y)]);
}

export function lonLatToTwd97(lon, lat) {
  return proj4("EPSG:4326", "EPSG:3826", [Number(lon), Number(lat)]);
}

export function ringToLonLat(ring) {
  return ring.map(([x, y]) => twd97ToLonLat(x, y));
}

export function ringToTwd97(ring) {
  return ring.map(([lon, lat]) => lonLatToTwd97(lon, lat));
}

export function lonLatHeightToEcef(lonDeg, latDeg, height = 0) {
  const a = 6378137.0;
  const e2 = 6.69437999014e-3;
  const lon = lonDeg * Math.PI / 180;
  const lat = latDeg * Math.PI / 180;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);

  return [
    (n + height) * cosLat * Math.cos(lon),
    (n + height) * cosLat * Math.sin(lon),
    (n * (1 - e2) + height) * sinLat
  ];
}

export function eastNorthUpToFixedFrame(lonDeg, latDeg, height = 0) {
  const lon = lonDeg * Math.PI / 180;
  const lat = latDeg * Math.PI / 180;
  const origin = lonLatHeightToEcef(lonDeg, latDeg, height);

  const east = [-Math.sin(lon), Math.cos(lon), 0];
  const north = [
    -Math.sin(lat) * Math.cos(lon),
    -Math.sin(lat) * Math.sin(lon),
    Math.cos(lat)
  ];
  const up = [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat)
  ];

  return [
    east[0], east[1], east[2], 0,
    north[0], north[1], north[2], 0,
    up[0], up[1], up[2], 0,
    origin[0], origin[1], origin[2], 1
  ];
}
