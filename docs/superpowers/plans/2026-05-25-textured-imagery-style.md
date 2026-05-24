# Textured Imagery Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `textured-terrain-edges` and `textured-height0-edges` outputs whose roof/wall style is selected from cached imagery samples, not random IDs.

**Architecture:** Keep the existing 3D Tiles pipeline and add a small texture subsystem. Imagery is cached by `provider/z/x/y`, decoded locally, sampled per building centroid, then matched to one of the configured crisp procedural styles. Missing imagery defaults to style `0` unless explicit download mode is enabled.

**Tech Stack:** Node.js ESM, Vitest, GDAL terrain sampling, PNG/JPEG decoding for cached imagery, existing b3dm/glTF writer.

---

### Tasks

- [x] Add failing tests for texture generation, textured materials, and GLB UV/texture output.
- [ ] Implement crisp procedural texture atlas generation.
- [ ] Update mesh generation to emit UVs and separate wall/roof primitives.
- [ ] Update GLB writer to embed texture images and `TEXCOORD_0`.
- [ ] Add imagery tile cache with local-first behavior and optional throttled download.
- [ ] Add style matcher that maps sampled roof color to a style index.
- [ ] Wire textured profile to use imagery-derived `textureStyleIndex`.
- [ ] Add scripts and demo options for `textured-terrain-edges` and `textured-height0-edges`.
- [ ] Rebuild both Taichung textured outputs and run verification.
