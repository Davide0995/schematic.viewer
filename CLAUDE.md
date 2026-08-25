# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

Schematic-viewer is a browser-based Minecraft schematic/litematic viewer built with Vite + Three.js.
It parses `.schematic` (WorldEdit/MCEdit) and `.litematic` (Litematica) NBT files, decodes block states,
builds a 3D mesh with face culling, and renders it with Three.js, supporting texture loading from
resource packs, wireframe rendering, and Y-axis slicing.

## Knowledge Base Integration

The user maintains a personal graphify-backed knowledge base at `C:\Users\david\Documents\kb`.
Configure it in your environment:

```powershell
$env:KB_ROOT = "C:\Users\david\Documents\kb"
```

Or set it permanently (Windows):

```powershell
[Environment]::SetEnvironmentVariable("KB_ROOT", "C:\Users\david\Documents\kb", "User")
```

Before answering questions about Minecraft schematic/litematic formats, NBT structure, or block state
encoding, query the relevant KB domain:

```powershell
# Minecraft schematic/litematic format questions
& "$env:KB_ROOT\.toolkit\kb-query.ps1" minecraft-formats query "<question>"
& "$env:KB_ROOT\.toolkit\kb-query.ps1" minecraft-formats explain "NBT or block state"

# Minecraft structure/generation context
& "$env:KB_ROOT\.toolkit\kb-query.ps1" minecraft-genai-research query "<question>"
```

On Unix/macOS or WSL:

```bash
export KB_ROOT="$HOME/kb"
bash "$KB_ROOT/.toolkit/kb-query.sh" minecraft-formats query "<question>"
```

The command must succeed. If the domain, graph, or graphify CLI is unavailable, state that the KB
could not be consulted rather than proceeding without retrieval. After answering, declare which KB
domains were queried.

## Project Structure

- `src/` — main Three.js viewer, NBT parser, block-state decoder, mesh builder, texture loader
- `index.html` — entry point
- `vite.config.js` — Vite config (TypeScript, fflate for ZIP extraction)

## Build & Dev

```bash
npm install
npm run dev      # dev server
npm run build    # production bundle
```

## Keeping the KB in sync

When you make significant architectural changes to the viewer (mesh builder refactor, new rendering
features, API changes, texture-loading changes), the KB domain `domains/personal_projects/schematic-viewer/docs/overview.md`
must be updated to reflect the new architecture and public interface. This is the curated snapshot
that downstream projects (buildbuddy, mollicraft) consult when deciding to embed or reuse it.

**After merging a significant architectural change:**

1. Check the change: Did it alter *how* the viewer works (mesh building, rendering, API surface)?
2. Update `domains/personal_projects/schematic-viewer/docs/overview.md` if so — describe the new
   architecture, the public API surface, and any breaking changes for downstream consumers.
3. Rebuild the schematic-viewer domain graph:
   ```bash
   cd ~/kb && ./.toolkit/rebuild.sh schematic-viewer
   ```

**Examples:**
- Refactored mesh builder (face culling, greedy mesh, etc.) → update Mesh Building section
- Added new rendering features (slicing, wireframe) → update Rendering Features section
- Changed public component API → update Public API section (downstream projects need to know)
- Added new block registry or texture-loading strategy → update those sections

If the change is internal (test update, internal helper rename), no KB update is needed.

## Public API

The viewer exports a main render component; see `src/index.ts` for the entry point.
This domain's `overview.md` in the KB describes the public interface for downstream projects
(buildbuddy, mollicraft) that may want to embed or reuse it.
