# Architecture

Schematic Viewer is a client-side Vite application. Schematic and resource-pack files are read in
the browser, not uploaded to an application server.

## Data flow

1. `index.html` defines the controls; `src/main.js` handles file selection, UI state, and rendering.
2. `src/nbt.js` reads compressed or uncompressed NBT. `src/litematic.js` and `src/schematic.js`
   decode it into dimensions, a block palette, and a block array. For `.nbt` files, the application
   tries litematic decoding first, then classic schematic decoding.
3. `src/texture-manager.js` loads the bundled default pack or a user-supplied pack.
   `src/resource-pack.js` resolves block states and models; `src/block-registry.js` and
   `src/block-shapes.js` provide block information and fallback geometry.
4. `src/renderer.js` builds Three.js geometry, controls the camera and rendering options, and uses
   `src/hover.js` to identify hovered blocks. Rebuilding the view applies the selected slice;
   wireframe and grid controls update the renderer directly.

`test/parsers.test.js` contains synthetic fixtures and unit tests for decoding and related block and
resource-pack logic. `browser-test/smoke.js` checks loading a synthetic schematic in Chromium using
an empty synthetic default pack, so it does not validate the bundled pack.
`npm test` runs the unit tests; `npm run test:browser` runs the browser smoke test after Chromium is
installed. `npm run build` checks the production build.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.
