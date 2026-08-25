---
applyTo: "**"
---

# Knowledge Base Integration

Before answering questions about Minecraft schematic/litematic formats, NBT structure, or block state
encoding, query the linked KB domains.

## Configuration

Set `KB_ROOT` to the absolute path of the KB:

```powershell
$env:KB_ROOT = "C:\Users\david\Documents\kb"
```

Or set it permanently (Windows):

```powershell
[Environment]::SetEnvironmentVariable("KB_ROOT", "C:\Users\david\Documents\kb", "User")
```

## Linked domains

- **`minecraft-formats`** — `.schematic` NBT parser ground truth, litematic bit-packing, block-state encoding, legacy numeric ID mapping
- **`minecraft-genai-research`** — prior art on generating/manipulating Minecraft structures via ML

## When to query

Consult the KB for questions involving:

- Minecraft `.schematic` or `.litematic` NBT format and encoding
- Block state storage and decoding (palette lookups, bit-packing for litematic)
- Resource pack texture loading or block registry
- Schematic import/export or validation
- Integration with structure generation tools

## How to query

```powershell
& "$env:KB_ROOT\.toolkit\kb-query.ps1" minecraft-formats query "<question>"
& "$env:KB_ROOT\.toolkit\kb-query.ps1" minecraft-formats explain "NBT or litematic"
& "$env:KB_ROOT\.toolkit\kb-query.ps1" minecraft-formats path "block state" "palette"

# On Unix/macOS or WSL:
export KB_ROOT="$HOME/kb"
bash "$KB_ROOT/.toolkit/kb-query.sh" minecraft-formats query "<question>"
```

## Contract

The command must succeed. If the domain, graph, or graphify CLI is unavailable, state that the KB
could not be consulted rather than proceeding without retrieval. After answering, declare which KB
domains were queried.

## Keeping the KB in sync

When significant architectural changes are merged (mesh builder refactors, new rendering features,
API changes, texture-loading changes), notify the user to update the KB:

```
After this PR merges, update the KB domain:
  cd ~/kb && ./.toolkit/rebuild.sh schematic-viewer

Edit: domains/personal_projects/schematic-viewer/docs/overview.md
```

Architectural changes that require KB sync:
- Mesh building algorithm refactoring (face culling, greedy mesh, etc.)
- New rendering features (slicing, wireframe, overlays)
- Public component API changes
- Block registry or texture-loading strategy changes
- NBT parsing or block-state decoding changes

Internal changes that do NOT require sync: test updates, helper function renames, logging tweaks.

**Important for downstream projects:** buildbuddy and mollicraft may embed this viewer. Breaking API
changes must be noted in the KB so they know to update their integration.
