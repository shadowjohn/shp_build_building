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
  const indices = [];
  const primitives = [];
  for (const mesh of meshes) {
    const indexOffset = indices.length;
    for (const index of mesh.indices) indices.push(index + vertexOffset);
    primitives.push({
      attributes: { POSITION: 0 },
      indices: primitives.length + 1,
      material: mesh.materialIndex
    });
    mesh.indexByteOffset = indexOffset * 4;
    mesh.indexCount = mesh.indices.length;
    vertexOffset += mesh.positions.length / 3;
  }

  const mins = [0, 1, 2].map((axis) => Math.min(...meshes.map((mesh) => mesh.min[axis])));
  const maxs = [0, 1, 2].map((axis) => Math.max(...meshes.map((mesh) => mesh.max[axis])));
  const positionBytes = floatBuffer(positions);
  const indexBytes = indexBuffer(indices);
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
      ...meshes.map((mesh) => ({
        bufferView: 1,
        byteOffset: mesh.indexByteOffset,
        componentType: 5125,
        count: mesh.indexCount,
        type: "SCALAR"
      }))
    ],
    materials: materials.map((material) => ({
      name: material.name,
      pbrMetallicRoughness: { baseColorFactor: material.baseColorFactor, metallicFactor: 0, roughnessFactor: 0.85 }
    })),
    meshes: [{ primitives }],
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
