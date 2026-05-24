(function main() {
  const status = document.getElementById("status");
  const profileSelect = document.getElementById("profile");
  const baseMapSelect = document.getElementById("baseMap");
  const params = new URLSearchParams(location.search);
  const county = params.get("county") || "taichung";
  let activeLayer = null;
  let activeImageryLayer = null;

  profileSelect.value = params.get("profile") || "procedural";
  baseMapSelect.value = params.get("baseMap") || "googlesatellite";

  function setStatus(text) {
    status.textContent = text;
  }

  function tilesetUrl() {
    return `/output/${county}/${profileSelect.value}/tileset.json`;
  }

  function loadTileset(map) {
    if (activeLayer) {
      map.removeItem(activeLayer);
      activeLayer = null;
    }

    const op = {
      details: {
        skipLevelOfDetail: false,
        baseScreenSpaceError: 1024,
        skipScreenSpaceErrorFactor: 16,
        skipLevels: 1,
        immediatelyLoadDesiredLevelOfDetail: false,
        loadSiblings: false,
        cullWithChildrenBounds: true
      }
    };

    activeLayer = new dg3D("3dtiles", tilesetUrl(), op);
    map.addItem(activeLayer);
    if (typeof activeLayer.setOpacity === "function") {
      activeLayer.setOpacity(profileSelect.value === "white" ? 0.55 : 0.72);
    }
    setStatus(`Tileset loading: ${county}/${profileSelect.value}`);
  }

  function getCesiumScene(map) {
    if (map._olcesium && map._olcesium.scene) return map._olcesium.scene;
    if (map._olcesium && map._olcesium.ol3d && map._olcesium.ol3d.scene_) return map._olcesium.ol3d.scene_;
    const viewer = typeof map.get3DViewer === "function" ? map.get3DViewer() : null;
    if (viewer && viewer.scene) return viewer.scene;
    return null;
  }

  function createImageryProvider(baseMap) {
    if (baseMap === "googlemap") {
      return new Cesium.UrlTemplateImageryProvider({
        url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        maximumLevel: 20
      });
    }
    if (baseMap === "osm") {
      return new Cesium.UrlTemplateImageryProvider({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        maximumLevel: 19
      });
    }
    if (baseMap === "nlscphoto") {
      return new Cesium.UrlTemplateImageryProvider({
        url: "https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
        maximumLevel: 20
      });
    }
    if (baseMap === "nlscmap") {
      return new Cesium.UrlTemplateImageryProvider({
        url: "https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}",
        maximumLevel: 20
      });
    }
    return new Cesium.UrlTemplateImageryProvider({
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      maximumLevel: 20
    });
  }

  function switchCesiumBaseMap(map) {
    const scene = getCesiumScene(map);
    const imageryLayers = scene && (scene.imageryLayers || (scene.globe && scene.globe.imageryLayers));
    if (!imageryLayers) return;
    if (activeImageryLayer) {
      imageryLayers.remove(activeImageryLayer, false);
      activeImageryLayer = null;
    }
    activeImageryLayer = imageryLayers.addImageryProvider(createImageryProvider(baseMapSelect.value), 1);
    if (scene.requestRender) scene.requestRender();
  }

  const map = new Easymap("map");
  window.map = map;

  map.enable3D(function () {
    map.setTerrainUrl(`/data/terrain20M/${county}`);
    map.enable3DTerrain();
    map.switchMapType(baseMapSelect.value);
    switchCesiumBaseMap(map);
    map.panTo3D(new dgXYZ(120.66588368, 24.11933551, 2600));
    map.set3DTilt(0.9);
    map.set3DHeading(0);
    loadTileset(map);
    setStatus(`Terrain: /data/terrain20M/${county}`);
  });

  profileSelect.addEventListener("change", function () {
    loadTileset(map);
  });

  baseMapSelect.addEventListener("change", function () {
    map.switchMapType(baseMapSelect.value);
    switchCesiumBaseMap(map);
  });

  document.getElementById("flyHome").addEventListener("click", function () {
    map.panTo3D(new dgXYZ(120.66588368, 24.11933551, 2600));
    map.set3DTilt(0.9);
    map.set3DHeading(0);
  });
}());
