import { createTexturePng } from "./texture-generator.js";

function pad4(buffer, padByte = 0x20) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, padByte)]) : buffer;
}

function floatBuffer(values) {
  const buffer = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer;
}

function indexBuffer(values) {
  const buffer = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buffer.writeUInt32LE(value, index * 4));
  return buffer;
}

export function createGlb({ meshes, materials }) {
  const positions = meshes.flatMap((mesh) => mesh.positions);
  const texcoords = meshes.flatMap((mesh) => mesh.texcoords || []);
  let vertexOffset = 0;
  const groupedTriangles = new Map();
  const groupedLines = new Map();
  function appendGroup(map, materialIndex, indices, offset) {
    if (!indices || !indices.length) return;
    if (!map.has(materialIndex)) map.set(materialIndex, []);
    const group = map.get(materialIndex);
    for (const index of indices) group.push(index + offset);
  }
  for (const mesh of meshes) {
    const materialIndex = mesh.materialIndex ?? 0;
    if (mesh.groundMaterialIndex !== undefined) {
      appendGroup(groupedTriangles, mesh.groundMaterialIndex, mesh.groundIndices, vertexOffset);
    }
    appendGroup(groupedTriangles, materialIndex, mesh.indices, vertexOffset);
    appendGroup(groupedTriangles, mesh.roofMaterialIndex ?? materialIndex, mesh.roofIndices, vertexOffset);
    if (mesh.lineIndices && mesh.lineIndices.length) {
      const lineMaterialIndex = mesh.lineMaterialIndex ?? materialIndex;
      appendGroup(groupedLines, lineMaterialIndex, mesh.lineIndices, vertexOffset);
    }
    vertexOffset += mesh.positions.length / 3;
  }

  const mins = [0, 1, 2].map((axis) => Math.min(...meshes.map((mesh) => mesh.min[axis])));
  const maxs = [0, 1, 2].map((axis) => Math.max(...meshes.map((mesh) => mesh.max[axis])));
  const positionBytes = floatBuffer(positions);
  const texcoordBytes = texcoords.length ? floatBuffer(texcoords) : Buffer.alloc(0);
  const triangleGroups = [...groupedTriangles.entries()].sort(([a], [b]) => a - b).map(([materialIndex, indices]) => ({
    mode: 4,
    materialIndex,
    indices,
    byteOffset: 0,
    byteLength: indices.length * 4
  }));
  const lineGroups = [...groupedLines.entries()].sort(([a], [b]) => a - b).map(([materialIndex, indices]) => ({
    mode: 1,
    materialIndex,
    indices,
    byteOffset: 0,
    byteLength: indices.length * 4
  }));
  const groups = [...triangleGroups, ...lineGroups];
  let indexByteOffset = 0;
  const indexBuffers = groups.map((group) => {
    group.byteOffset = indexByteOffset;
    indexByteOffset += group.byteLength;
    return indexBuffer(group.indices);
  });
  const indexBytes = Buffer.concat(indexBuffers);
  const textureInfos = [];
  const imageBuffers = [];
  const textureIndexByKey = new Map();
  for (const material of materials) {
    if (!material.texture) {
      textureInfos.push(null);
      continue;
    }
    const key = `${material.texture.kind}:${material.texture.styleIndex}`;
    if (!textureIndexByKey.has(key)) {
      textureIndexByKey.set(key, imageBuffers.length);
      imageBuffers.push(pad4(createTexturePng(material.texture), 0));
    }
    textureInfos.push(textureIndexByKey.get(key));
  }
  const imageBytes = Buffer.concat(imageBuffers);
  const positionOffset = 0;
  const texcoordOffset = positionOffset + positionBytes.length;
  const indexOffset = texcoordOffset + texcoordBytes.length;
  const imageOffset = indexOffset + indexBytes.length;
  const bin = pad4(Buffer.concat([positionBytes, texcoordBytes, indexBytes, imageBytes]), 0);
  const bufferViews = [
    { buffer: 0, byteOffset: positionOffset, byteLength: positionBytes.length, target: 34962 }
  ];
  if (texcoordBytes.length) {
    bufferViews.push({ buffer: 0, byteOffset: texcoordOffset, byteLength: texcoordBytes.length, target: 34962 });
  }
  const indexBufferView = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: indexOffset, byteLength: indexBytes.length, target: 34963 });
  const imageBufferViewStart = bufferViews.length;
  let relativeImageOffset = 0;
  for (const imageBuffer of imageBuffers) {
    bufferViews.push({ buffer: 0, byteOffset: imageOffset + relativeImageOffset, byteLength: imageBuffer.length });
    relativeImageOffset += imageBuffer.length;
  }
  const accessors = [
    { bufferView: 0, componentType: 5126, count: positions.length / 3, type: "VEC3", min: mins, max: maxs }
  ];
  const texcoordAccessor = texcoordBytes.length ? accessors.length : null;
  if (texcoordBytes.length) {
    accessors.push({ bufferView: 1, componentType: 5126, count: texcoords.length / 2, type: "VEC2", min: [0, 0], max: [1, 1] });
  }
  const indexAccessorStart = accessors.length;
  accessors.push(...groups.map((group) => ({
    bufferView: indexBufferView,
    byteOffset: group.byteOffset,
    componentType: 5125,
    count: group.indices.length,
    type: "SCALAR"
  })));
  const json = {
    asset: { version: "2.0", generator: "shp_build_building" },
    buffers: [{ byteLength: bin.length }],
    bufferViews,
    accessors,
    ...(imageBuffers.length ? {
      images: imageBuffers.map((_, index) => ({ bufferView: imageBufferViewStart + index, mimeType: "image/png" })),
      samplers: [{ magFilter: 9728, minFilter: 9984, wrapS: 10497, wrapT: 10497 }],
      textures: imageBuffers.map((_, index) => ({ sampler: 0, source: index }))
    } : {}),
    materials: materials.map((material, index) => {
      const pbr = { baseColorFactor: material.baseColorFactor, metallicFactor: 0, roughnessFactor: material.texture ? 0.7 : 0.85 };
      if (textureInfos[index] !== null) pbr.baseColorTexture = { index: textureInfos[index] };
      return {
        name: material.name,
        doubleSided: true,
        ...(material.baseColorFactor[3] < 1 ? { alphaMode: "BLEND" } : {}),
        pbrMetallicRoughness: pbr
      };
    }),
    meshes: [{
      primitives: groups.map((group, index) => ({
        attributes: { POSITION: 0, ...(texcoordAccessor !== null ? { TEXCOORD_0: texcoordAccessor } : {}) },
        indices: indexAccessorStart + index,
        material: group.materialIndex,
        mode: group.mode
      }))
    }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0
  };
  const jsonChunk = pad4(Buffer.from(JSON.stringify(json), "utf8"));
  const totalLength = 12 + 8 + jsonChunk.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.write("JSON", 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.write("BIN\0", 4);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
}
