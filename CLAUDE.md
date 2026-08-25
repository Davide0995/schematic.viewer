# CLAUDE.md

This file provides guidance for coding agents working in this repository.

## What This Repo Is

Schematic Viewer is a browser-based Minecraft schematic/litematic viewer built with Vite and Three.js. It parses `.schematic` and `.litematic` NBT files, decodes block states, builds a 3D mesh with face culling, and renders it with Three.js. It also supports user-supplied resource-pack textures, wireframe rendering, and Y-axis slicing.

## Project Structure

- `src/` - NBT parsing, schematic decoding, block registry, mesh building, rendering, and texture loading
- `index.html` - browser entry point
- `src/main.js` - application wiring and file-loading controls
- `vite.config.js` - Vite and GitHub Pages configuration

## Build and Development

```bash
npm install
npm run dev
npm test
npm run build
```

## Contribution Notes

- Keep changes focused and follow `CONTRIBUTING.md`.
- Add regression tests for parser and decoder changes.
- Do not commit `node_modules/`, `dist/`, resource packs, or copyrighted sample files.
- Update `README.md` when supported formats, limitations, or user-facing behavior change.
