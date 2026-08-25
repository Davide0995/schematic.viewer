// Non-cube block shapes: returns an array of axis-aligned boxes { x0,y0,z0,x1,y1,z1 }
// or null for full-cube blocks.
// Each box face has correct proportional UVs.

function parseProps(blockName) {
  const m = blockName.match(/\[(.+)\]/);
  if (!m) return {};
  const p = {};
  for (const pair of m[1].split(',')) {
    const eq = pair.indexOf('=');
    p[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return p;
}

// Face definitions per box with UV derived from geometry.
// UV formulas (verified against full-block FACES):
//   top    : u=x,   v=z    (vertex order: [x0,z1],[x1,z1],[x1,z0],[x0,z0])
//   bottom : u=x,   v=z    (vertex order: [x0,z0],[x1,z0],[x1,z1],[x0,z1])
//   north  : u=1-x, v=1-y  (vertex order: [1-x1,1-y0],[1-x0,1-y0],[1-x0,1-y1],[1-x1,1-y1])
//   south  : u=x,   v=1-y  (vertex order: [x0,1-y0],[x1,1-y0],[x1,1-y1],[x0,1-y1])
//   east   : u=1-z, v=1-y  (vertex order: [1-z1,1-y0],[1-z0,1-y0],[1-z0,1-y1],[1-z1,1-y1])
//   west   : u=z,   v=1-y  (vertex order: [z0,1-y0],[z1,1-y0],[z1,1-y1],[z0,1-y1])
export function boxToFaces({ x0, y0, z0, x1, y1, z1 }) {
  return [
    { // Top (+Y) - CCW from above
      verts: [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]],
      normal: [0,1,0], faceName: 'top', brightness: 1.0,
      uvs: [[x0,z1],[x1,z1],[x1,z0],[x0,z0]],
      atBoundary: y1 >= 1.0 - 1e-4,
    },
    { // Bottom (-Y)
      verts: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],
      normal: [0,-1,0], faceName: 'bottom', brightness: 0.5,
      uvs: [[x0,z0],[x1,z0],[x1,z1],[x0,z1]],
      atBoundary: y0 <= 1e-4,
    },
    { // North (-Z)
      verts: [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]],
      normal: [0,0,-1], faceName: 'north', brightness: 0.8,
      uvs: [[1-x1,1-y0],[1-x0,1-y0],[1-x0,1-y1],[1-x1,1-y1]],
      atBoundary: z0 <= 1e-4,
    },
    { // South (+Z)
      verts: [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],
      normal: [0,0,1], faceName: 'south', brightness: 0.8,
      uvs: [[x0,1-y0],[x1,1-y0],[x1,1-y1],[x0,1-y1]],
      atBoundary: z1 >= 1.0 - 1e-4,
    },
    { // East (+X)
      verts: [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]],
      normal: [1,0,0], faceName: 'east', brightness: 0.9,
      uvs: [[1-z1,1-y0],[1-z0,1-y0],[1-z0,1-y1],[1-z1,1-y1]],
      atBoundary: x1 >= 1.0 - 1e-4,
    },
    { // West (-X)
      verts: [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],
      normal: [-1,0,0], faceName: 'west', brightness: 0.9,
      uvs: [[z0,1-y0],[z1,1-y0],[z1,1-y1],[z0,1-y1]],
      atBoundary: x0 <= 1e-4,
    },
  ];
}

// Step boxes for stairs given the step Y range [sY0, sY1]
function stepBoxes(facing, shape, sY0, sY1) {
  switch (facing) {
    case 'east': {
      const main = { x0:0.5, y0:sY0, z0:0, x1:1, y1:sY1, z1:1 };
      if (shape === 'inner_right') return [main, { x0:0, y0:sY0, z0:0.5, x1:0.5, y1:sY1, z1:1 }];
      if (shape === 'inner_left')  return [main, { x0:0, y0:sY0, z0:0,   x1:0.5, y1:sY1, z1:0.5 }];
      if (shape === 'outer_right') return [{ x0:0.5, y0:sY0, z0:0,   x1:1, y1:sY1, z1:0.5 }];
      if (shape === 'outer_left')  return [{ x0:0.5, y0:sY0, z0:0.5, x1:1, y1:sY1, z1:1 }];
      return [main];
    }
    case 'west': {
      const main = { x0:0, y0:sY0, z0:0, x1:0.5, y1:sY1, z1:1 };
      if (shape === 'inner_right') return [main, { x0:0.5, y0:sY0, z0:0,   x1:1, y1:sY1, z1:0.5 }];
      if (shape === 'inner_left')  return [main, { x0:0.5, y0:sY0, z0:0.5, x1:1, y1:sY1, z1:1 }];
      if (shape === 'outer_right') return [{ x0:0, y0:sY0, z0:0.5, x1:0.5, y1:sY1, z1:1 }];
      if (shape === 'outer_left')  return [{ x0:0, y0:sY0, z0:0,   x1:0.5, y1:sY1, z1:0.5 }];
      return [main];
    }
    case 'south': {
      const main = { x0:0, y0:sY0, z0:0.5, x1:1, y1:sY1, z1:1 };
      if (shape === 'inner_right') return [main, { x0:0.5, y0:sY0, z0:0, x1:1,   y1:sY1, z1:0.5 }];
      if (shape === 'inner_left')  return [main, { x0:0,   y0:sY0, z0:0, x1:0.5, y1:sY1, z1:0.5 }];
      if (shape === 'outer_right') return [{ x0:0,   y0:sY0, z0:0.5, x1:0.5, y1:sY1, z1:1 }];
      if (shape === 'outer_left')  return [{ x0:0.5, y0:sY0, z0:0.5, x1:1,   y1:sY1, z1:1 }];
      return [main];
    }
    case 'north':
    default: {
      const main = { x0:0, y0:sY0, z0:0, x1:1, y1:sY1, z1:0.5 };
      if (shape === 'inner_right') return [main, { x0:0,   y0:sY0, z0:0.5, x1:0.5, y1:sY1, z1:1 }];
      if (shape === 'inner_left')  return [main, { x0:0.5, y0:sY0, z0:0.5, x1:1,   y1:sY1, z1:1 }];
      if (shape === 'outer_right') return [{ x0:0.5, y0:sY0, z0:0,   x1:1,   y1:sY1, z1:0.5 }];
      if (shape === 'outer_left')  return [{ x0:0,   y0:sY0, z0:0,   x1:0.5, y1:sY1, z1:0.5 }];
      return [main];
    }
  }
}

/**
 * Returns an array of axis-aligned boxes for non-full blocks,
 * or null for full-cube blocks (handled by standard face loop).
 */
export function getBlockBoxes(blockName) {
  const base = blockName.replace('minecraft:', '').split('[')[0];

  // ── Slabs ──────────────────────────────────────────────────────
  if (base.endsWith('_slab') || base === 'slab') {
    const props = parseProps(blockName);
    const type = props.type ?? 'bottom';
    if (type === 'double') return null; // full cube
    const y0 = type === 'top' ? 0.5 : 0;
    const y1 = type === 'top' ? 1   : 0.5;
    return [{ x0:0, y0, z0:0, x1:1, y1, z1:1 }];
  }

  // ── Stairs ─────────────────────────────────────────────────────
  if (base.endsWith('_stairs') || base === 'stairs') {
    const props  = parseProps(blockName);
    const facing = props.facing ?? 'north';
    const half   = props.half   ?? 'bottom';
    const shape  = props.shape  ?? 'straight';

    const baseY0 = half === 'bottom' ? 0   : 0.5;
    const baseY1 = half === 'bottom' ? 0.5 : 1;
    const stepY0 = half === 'bottom' ? 0.5 : 0;
    const stepY1 = half === 'bottom' ? 1   : 0.5;

    const boxes = [
      // Base slab portion
      { x0:0, y0:baseY0, z0:0, x1:1, y1:baseY1, z1:1 },
      // Step portion(s)
      ...stepBoxes(facing, shape, stepY0, stepY1),
    ];
    return boxes;
  }

  // ── Carpets / Snow layers (1/16 height) ────────────────────────
  if (base.endsWith('_carpet') || base === 'carpet') {
    return [{ x0:0, y0:0, z0:0, x1:1, y1:1/16, z1:1 }];
  }

  return null; // full cube
}
