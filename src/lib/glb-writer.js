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
  let vertexOffset = 0;
  const groupedIndices = new Map();
  for (const mesh of meshes) {
    const materialIndex = mesh.materialIndex ?? 0;
    if (!groupedIndices.has(materialIndex)) groupedIndices.set(materialIndex, []);
    const group = groupedIndices.get(materialIndex);
    for (const index of mesh.indices) group.push(index + vertexOffset);
    vertexOffset += mesh.positions.length / 3;
  }

  const mins = [0, 1, 2].map((axis) => Math.min(...meshes.map((mesh) => mesh.min[axis])));
  const maxs = [0, 1, 2].map((axis) => Math.max(...meshes.map((mesh) => mesh.max[axis])));
  const positionBytes = floatBuffer(positions);
  const groups = [...groupedIndices.entries()].sort(([a], [b]) => a - b).map(([materialIndex, indices]) => ({
    materialIndex,
    indices,
    byteOffset: 0,
    byteLength: indices.length * 4
  }));
  let indexByteOffset = 0;
  const indexBuffers = groups.map((group) => {
    group.byteOffset = indexByteOffset;
    indexByteOffset += group.byteLength;
    return indexBuffer(group.indices);
  });
  const indexBytes = Buffer.concat(indexBuffers);
  const bin = pad4(Buffer.concat([positionBytes, indexBytes]), 0);
  const json = {
    asset: { version: "2.0", generator: "shp_build_building" },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBytes.length, target: 34962 },
      { buffer: 0, byteOffset: positionBytes.length, byteLength: indexBytes.length, target: 34963 }
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: "VEC3", min: mins, max: maxs },
      ...groups.map((group) => ({
        bufferView: 1,
        byteOffset: group.byteOffset,
        componentType: 5125,
        count: group.indices.length,
        type: "SCALAR"
      }))
    ],
    materials: materials.map((material) => ({
      name: material.name,
      doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: material.baseColorFactor, metallicFactor: 0, roughnessFactor: 0.85 }
    })),
    meshes: [{
      primitives: groups.map((group, index) => ({
        attributes: { POSITION: 0 },
        indices: index + 1,
        material: group.materialIndex
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
