export function lonLatToTilePixel(lon, lat, zoom, tileSize = 256) {
  const sinLat = Math.sin(lat * Math.PI / 180);
  const n = 2 ** zoom;
  const worldX = ((lon + 180) / 360) * n * tileSize;
  const worldY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n * tileSize;
  const x = Math.floor(worldX / tileSize);
  const y = Math.floor(worldY / tileSize);
  return {
    z: zoom,
    x,
    y,
    pixelX: Math.max(0, Math.min(tileSize - 1, Math.floor(worldX - x * tileSize))),
    pixelY: Math.max(0, Math.min(tileSize - 1, Math.floor(worldY - y * tileSize)))
  };
}

export function tileUrl(provider, tile) {
  if (provider === "google_satellite") {
    return `https://mt1.google.com/vt/lyrs=s&x=${tile.x}&y=${tile.y}&z=${tile.z}`;
  }
  if (provider === "nlsc_photo") {
    return `https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/${tile.z}/${tile.y}/${tile.x}.jpg`;
  }
  throw new Error(`Unsupported imagery provider: ${provider}`);
}
