(function main() {
  const status = document.getElementById("status");
  const profileSelect = document.getElementById("profile");
  const params = new URLSearchParams(location.search);
  const county = params.get("county") || "taichung";
  let activeLayer = null;

  profileSelect.value = params.get("profile") || "procedural";

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
      activeLayer.setOpacity(0.96);
    }
    setStatus(`Tileset loading: ${county}/${profileSelect.value}`);
  }

  const map = new Easymap("map");
  window.map = map;

  map.enable3D(function () {
    map.setTerrainUrl(`/data/terrain20M/${county}`);
    map.enable3DTerrain();
    map.switchMapType("googlesatellite");
    map.panTo3D(new dgXYZ(120.66588368, 24.11933551, 2600));
    map.set3DTilt(0.9);
    map.set3DHeading(0);
    loadTileset(map);
    setStatus(`Terrain: /data/terrain20M/${county}`);
  });

  profileSelect.addEventListener("change", function () {
    loadTileset(map);
  });

  document.getElementById("flyHome").addEventListener("click", function () {
    map.panTo3D(new dgXYZ(120.66588368, 24.11933551, 2600));
    map.set3DTilt(0.9);
    map.set3DHeading(0);
  });
}());
