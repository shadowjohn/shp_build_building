(function main() {
  const status = document.getElementById("status");
  const profileSelect = document.getElementById("profile");
  const baseMapSelect = document.getElementById("baseMap");
  const buildingsVisible = document.getElementById("buildingsVisible");
  const params = new URLSearchParams(location.search);
  const county = params.get("county") || "taichung";
  let activeLayer = null;
  let activeImageryLayer = null;

  const defaultProfile = "textured-terrain-edges";
  const requestedProfile = params.get("profile");
  profileSelect.value = requestedProfile || defaultProfile;
  if (!profileSelect.value) profileSelect.value = defaultProfile;
  baseMapSelect.value = params.get("baseMap") || "nlscphoto";

  function setStatus(text) {
    status.textContent = text;
  }

  function tilesetUrl() {
    return `/output/${county}/${profileSelect.value}/tileset.json`;
  }

  function terrainUrl() {
    return "https://3wa.tw/data/terrain20M/taiwan";
  }

  function removeTileset(map) {
    if (activeLayer) {
      map.removeItem(activeLayer);
      activeLayer = null;
    }
  }

  function loadTileset(map) {
    removeTileset(map);

    if (!buildingsVisible.checked) {
      setStatus(`Buildings hidden: ${county}/${profileSelect.value}`);
      return;
    }

    const op = {
      details: {
        maximumScreenSpaceError: 48,
        skipLevelOfDetail: true,
        baseScreenSpaceError: 1024,
        skipScreenSpaceErrorFactor: 24,
        skipLevels: 2,
        immediatelyLoadDesiredLevelOfDetail: false,
        loadSiblings: false,
        cullWithChildrenBounds: true,
        cullRequestsWhileMoving: true,
        cullRequestsWhileMovingMultiplier: 80,
        dynamicScreenSpaceError: true,
        dynamicScreenSpaceErrorDensity: 0.002,
        dynamicScreenSpaceErrorFactor: 24,
        foveatedScreenSpaceError: true,
        foveatedConeSize: 0.25,
        foveatedMinimumScreenSpaceErrorRelaxation: 0,
        progressiveResolutionHeightFraction: 0.35,
        preferLeaves: false,
        preloadWhenHidden: false,
        cacheBytes: 256 * 1024 * 1024,
        maximumCacheOverflowBytes: 128 * 1024 * 1024,
        maximumMemoryUsage: 256
      }
    };

    activeLayer = new dg3D("3dtiles", tilesetUrl(), op);
    map.addItem(activeLayer);
    if (typeof activeLayer.setOpacity === "function") {
      activeLayer.setOpacity(profileSelect.value.startsWith("white") ? 0.55 : 0.72);
    }
    setStatus(`Tileset loading: ${county}/${profileSelect.value}`);
  }

  function getCesiumScene(map) {
    if (typeof map.get3DScene === "function") return map.get3DScene();
    if (map._olcesium && map._olcesium.scene) return map._olcesium.scene;
    if (map._olcesium && map._olcesium.ol3d && map._olcesium.ol3d.scene_) return map._olcesium.ol3d.scene_;
    const viewer = typeof map.get3DViewer === "function" ? map.get3DViewer() : null;
    if (viewer && viewer.scene) return viewer.scene;
    return null;
  }

  function createImageryProvider(baseMap) {
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
      url: "https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
      maximumLevel: 20
    });
  }

  function switchCesiumBaseMap(map) {
    const scene = getCesiumScene(map);
    const imageryLayers = (typeof map.get3DImageryLayers === "function" && map.get3DImageryLayers()) ||
      (scene && (scene.imageryLayers || (scene.globe && scene.globe.imageryLayers)));
    if (!imageryLayers) return;
    if (activeImageryLayer) {
      imageryLayers.remove(activeImageryLayer, false);
      activeImageryLayer = null;
    }
    activeImageryLayer = imageryLayers.addImageryProvider(createImageryProvider(baseMapSelect.value));
    activeImageryLayer.alpha = 1;
    if (typeof imageryLayers.raiseToTop === "function") imageryLayers.raiseToTop(activeImageryLayer);
    if (scene.requestRender) scene.requestRender();
  }

  function syncCesiumBaseMap(map) {
    switchCesiumBaseMap(map);
    setTimeout(function () { switchCesiumBaseMap(map); }, 500);
    setTimeout(function () { switchCesiumBaseMap(map); }, 1500);
  }

  const map = new Easymap("map");
  window.map = map;
  window.__taichung3dDebug = function () {
    const scene = getCesiumScene(map);
    const imageryLayers = (typeof map.get3DImageryLayers === "function" && map.get3DImageryLayers()) ||
      (scene && (scene.imageryLayers || (scene.globe && scene.globe.imageryLayers)));
    return {
      hasScene: !!scene,
      imageryLayerCount: imageryLayers ? imageryLayers.length : 0,
      activeImageryLayerIndex: imageryLayers && activeImageryLayer ? imageryLayers.indexOf(activeImageryLayer) : -1,
      baseMap: baseMapSelect.value,
      terrainUrl: terrainUrl(),
      terrainProvider: scene && scene.terrainProvider && scene.terrainProvider.constructor && scene.terrainProvider.constructor.name
    };
  };

  map.enable3D(function () {
    map.setTerrainUrl(terrainUrl());
    map.enable3DTerrain();
    map.switchMapType(baseMapSelect.value);
    syncCesiumBaseMap(map);
    map.panTo3D(new dgXYZ(120.66588368, 24.11933551, 2600));
    map.set3DTilt(0.9);
    map.set3DHeading(0);
    loadTileset(map);
    setStatus(`Terrain: ${terrainUrl()}`);
  });

  profileSelect.addEventListener("change", function () {
    loadTileset(map);
  });

  buildingsVisible.addEventListener("change", function () {
    if (buildingsVisible.checked) {
      loadTileset(map);
    } else {
      removeTileset(map);
      setStatus(`Buildings hidden: ${county}/${profileSelect.value}`);
    }
  });

  baseMapSelect.addEventListener("change", function () {
    map.switchMapType(baseMapSelect.value);
    syncCesiumBaseMap(map);
  });

  document.getElementById("flyHome").addEventListener("click", function () {
    map.panTo3D(new dgXYZ(120.66588368, 24.11933551, 2600));
    map.set3DTilt(0.9);
    map.set3DHeading(0);
  });
}());
