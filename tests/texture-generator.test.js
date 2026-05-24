import { describe, expect, it } from "vitest";
import { createTexturePng, TEXTURE_STYLE_COUNT } from "../src/lib/texture-generator.js";

describe("texture generator", () => {
  it("provides ten crisp procedural texture styles", () => {
    expect(TEXTURE_STYLE_COUNT).toBe(10);
    const wall = createTexturePng({ kind: "wall", styleIndex: 0, size: 128 });
    const roof = createTexturePng({ kind: "roof", styleIndex: 9, size: 128 });
    expect(wall.slice(1, 4).toString("ascii")).toBe("PNG");
    expect(roof.slice(1, 4).toString("ascii")).toBe("PNG");
    expect(wall.length).toBeGreaterThan(350);
    expect(roof.length).toBeGreaterThan(350);
  });
});
