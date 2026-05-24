import { ImageryCache } from "./imagery-cache.js";
import { lonLatToTilePixel } from "./web-mercator-tiles.js";
import { matchRoofStyle } from "./texture-style-matcher.js";

export function createImageryStyleSampler(config) {
  if (config.profile !== "textured") {
    return {
      enabled: false,
      async styleForLonLat() {
        return 0;
      },
      summary() {
        return { enabled: false };
      }
    };
  }

  const cache = new ImageryCache(config.imagery);
  let sampled = 0;
  let missed = 0;

  return {
    enabled: true,
    async styleForLonLat(lon, lat) {
      const tile = lonLatToTilePixel(lon, lat, config.imagery.zoom);
      const sample = await cache.sample(tile);
      if (sample) sampled += 1;
      else missed += 1;
      return matchRoofStyle(sample);
    },
    summary() {
      return {
        enabled: true,
        provider: config.imagery.provider,
        zoom: config.imagery.zoom,
        cacheRoot: config.imagery.root,
        allowDownload: config.imagery.allowDownload,
        downloaded: cache.downloadCount,
        sampled,
        missed
      };
    }
  };
}
