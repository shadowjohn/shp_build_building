export function createB3dm(glb) {
  const header = Buffer.alloc(28);
  header.write("b3dm", 0);
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(28 + glb.length, 8);
  header.writeUInt32LE(0, 12);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(0, 20);
  header.writeUInt32LE(0, 24);
  return Buffer.concat([header, glb]);
}
