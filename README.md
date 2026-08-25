# Minecraft Schematic Viewer

[![CI](https://github.com/Davide0995/schematic.viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/Davide0995/schematic.viewer/actions/workflows/ci.yml)

A browser-based viewer for Minecraft `.litematic`, `.schematic`, and compatible `.nbt` files. Load a build locally, inspect it in 3D, and optionally apply textures from a resource pack.

[Open the live demo](https://davide0995.github.io/schematic.viewer/)

## Features

- View Litematica `.litematic` files
- View classic WorldEdit/MCEdit `.schematic` files
- Load compatible `.nbt` files
- Pixel Perfection Legacy 26.2 default resource pack under CC BY-SA 4.0, with optional user-provided Minecraft resource packs
- Orbit, pan, zoom, and camera reset controls
- Hidden-face culling for more efficient geometry
- Resource-pack block models, variants, multipart states, rotations, and model face culling
- Wireframe overlay and ground grid
- Y-axis slicing for inspecting individual layers
- Sign text labels from supported block-entity data
- Runs entirely in the browser; files are not uploaded
- Automatically tracks new stable Minecraft releases and opens a maintenance issue when one is published

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

The included default pack is Pixel Perfection Legacy for Minecraft 26.2, a complete 16x resource pack distributed under CC BY-SA 4.0. Its 1.21.x compatibility overlay covers older files such as your 1.21.11 schematic. Its license and attribution are documented in [public/default-textures/ATTRIBUTION.md](public/default-textures/ATTRIBUTION.md). User-provided packs override it for the current browser session.

The viewer reads the litematic `MinecraftDataVersion` and the resource pack `pack.mcmeta`. Older schematic files continue to use their namespaced block IDs and states, while the UI reports when an older default pack may not contain newer block assets. For the closest result, load a pack matching the Minecraft version that created the schematic.

GitHub Actions checks Mojang's official version manifest daily and ignores snapshots and pre-releases. When a new stable release appears, it opens one deduplicated maintenance issue so the pack and compatibility code can be reviewed.

## Default texture attribution

The bundled default texture pack is [Pixel Perfection Legacy](https://www.curseforge.com/minecraft/texture-packs/pixel-perfection-legacy), originally created by **XSSheep** and continued by **Nova_Wostra** and contributors. The bundled 26.2 release includes current blockstates, models, textures, and a 1.21.x compatibility overlay and is distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This project preserves the attribution and ShareAlike requirements; see the complete [asset attribution](public/default-textures/ATTRIBUTION.md).

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

- Rendering is an approximation, not a complete Minecraft client renderer. Model rotations and culling are supported, but lighting, UV locking, tint colors, and some custom model behavior may differ from Minecraft.
- Classic numeric block IDs have broad coverage for common blocks and colored variants, but unknown or modded IDs fall back to stone.
- Some block states, orientations, custom blocks, fluids, and transparency effects may not match Minecraft exactly.
- Sign text is rendered as a readable label when present in block-entity data. Inventories, banners, entity models, and other block-entity visuals are not currently rendered.
- Large files are decoded into an in-memory block array and meshed on the client. The renderer caches repeated block metadata, but very large files can still require substantial browser memory and GPU resources.
- The bundled default pack is not made from Mojang assets. It is Pixel Perfection Legacy with attribution and license information in `public/default-textures/`. Users can load another resource pack for different styles or version-specific assets.
- The bundled Pixel Perfection Legacy release targets Minecraft 26.2 and includes a 1.21.x overlay; older schematic IDs and states remain supported, while newer or modded blocks may still require a matching user pack.

Please include the file format, Minecraft/Litematica version, browser, and whether a resource pack was loaded when reporting a compatibility problem.

## Privacy and assets

Schematic and resource-pack files are processed locally in your browser and are discarded when the page session ends. This project does not provide a server upload or cloud storage service. Users are responsible for having the right to use any additional resource pack they select.

Minecraft, Mojang, Litematica, WorldEdit, and any third-party resource packs are trademarks or assets of their respective owners. This project is not affiliated with or endorsed by Mojang.

## Contributing

Bug reports, compatibility fixtures, documentation improvements, and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

The source code is available under the [MIT License](LICENSE). Third-party dependencies and user-supplied resource packs remain subject to their own licenses.
