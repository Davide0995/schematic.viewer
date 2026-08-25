# Minecraft Schematic Viewer

[![CI](https://github.com/Davide0995/schematic.viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/Davide0995/schematic.viewer/actions/workflows/ci.yml)

A browser-based viewer for Minecraft `.litematic`, `.schematic`, and compatible `.nbt` files. Load a build locally, inspect it in 3D, and optionally apply textures from a resource pack.

[Open the live demo](https://davide0995.github.io/schematic.viewer/)

## Features

- View Litematica `.litematic` files
- View classic WorldEdit/MCEdit `.schematic` files
- Load compatible `.nbt` files
- Original procedural default textures, with optional textures from a Minecraft resource-pack `.zip` or `.jar`
- Orbit, pan, zoom, and camera reset controls
- Hidden-face culling for more efficient geometry
- Wireframe overlay and ground grid
- Y-axis slicing for inspecting individual layers
- Runs entirely in the browser; files are not uploaded

## Quick start

1. Open the [live demo](https://davide0995.github.io/schematic.viewer/).
2. Drop a schematic into the **Load File** area, or choose one from your device.
3. Optionally load a resource pack to display block textures.
4. Use the camera and rendering controls to inspect the build.

## Local development

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Create a production build and preview it locally:

```bash
npm run build
npm run preview
```

## Supported formats

| Format | Support |
| --- | --- |
| `.litematic` | Litematica regions and palettes are decoded into a 3D view |
| `.schematic` | Classic WorldEdit/MCEdit dimensions, blocks, and common legacy IDs |
| `.nbt` | Parsed as litematic first, then classic schematic |
| Resource-pack `.zip` / Minecraft `.jar` | Optional block texture loading |

## Known limitations

- Rendering is an approximation, not a complete Minecraft client renderer.
- Classic numeric block IDs have partial coverage.
- Some block states, orientations, custom blocks, fluids, and transparency effects may not match Minecraft exactly.
- Entities, inventories, signs, banners, and other block-entity data are not currently rendered.
- Very large files can require substantial browser memory and GPU resources.
- The viewer includes original procedural fallback textures. User-supplied resource packs can override them and are not included in this repository.

Please include the file format, Minecraft/Litematica version, browser, and whether a resource pack was loaded when reporting a compatibility problem.

## Privacy and assets

Schematic and resource-pack files are processed locally in your browser. This project does not provide a server upload or cloud storage service. Do not provide files that you are not allowed to use or share.

Minecraft, Mojang, Litematica, WorldEdit, and any third-party resource packs are trademarks or assets of their respective owners. This project is not affiliated with or endorsed by Mojang.

## Contributing

Bug reports, compatibility fixtures, documentation improvements, and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

The source code is available under the [MIT License](LICENSE). Third-party dependencies and user-supplied resource packs remain subject to their own licenses.
