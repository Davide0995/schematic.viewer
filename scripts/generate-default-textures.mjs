import { deflateSync, zipSync } from 'fflate';
import { mkdirSync, writeFileSync } from 'node:fs';

const size = 16;
const outputDir = 'public/default-textures/assets/minecraft/textures/block';
const zipPath = 'public/default-textures.zip';
const textures = {
  stone: 'stone', cobblestone: 'cobblestone', deepslate: 'deepslate',
  dirt: 'dirt', grass_block_top: 'grass', grass_block_side: 'grass-side',
  sand: 'sand', gravel: 'gravel', clay: 'clay', bricks: 'bricks',
  oak_planks: 'planks', spruce_planks: 'planks', birch_planks: 'planks',
  oak_log: 'log', oak_log_top: 'log-top', spruce_log: 'log', spruce_log_top: 'log-top',
  glass: 'glass', ice: 'ice', water_still: 'water', lava_still: 'lava',
  oak_leaves: 'leaves', spruce_leaves: 'leaves', bookshelf: 'bookshelf',
  coal_ore: 'coal-ore', iron_ore: 'iron-ore', gold_ore: 'gold-ore', diamond_ore: 'diamond-ore',
  emerald_ore: 'emerald-ore', redstone_ore: 'redstone-ore', obsidian: 'obsidian',
};

const palettes = {
  stone: ['#8b8f91', '#777c7e', '#a4a8a8'], cobblestone: ['#777b7b', '#565c5c', '#969b98'],
  deepslate: ['#4c4d54', '#383941', '#666771'], dirt: ['#8b5a35', '#704426', '#a06b3f'],
  grass: ['#6fb34d', '#57913d', '#8ac45e'], 'grass-side': ['#6fb34d', '#8b5a35', '#704426'],
  sand: ['#d8c27e', '#c4aa62', '#eadb9b'], gravel: ['#92918b', '#777773', '#aaa9a3'],
  clay: ['#a9a29a', '#918b84', '#c0b9ae'], bricks: ['#a34f3d', '#70362e', '#c46a4e'],
  planks: ['#b7834b', '#8d5d32', '#d09a5c'], log: ['#815b38', '#5e3d24', '#a67a4a'],
  'log-top': ['#b1875c', '#6d4b31', '#d0a875'], glass: ['#b7dce0', '#76aeb8', '#e0ffff'],
  ice: ['#a6d9ed', '#73b5d1', '#d5f4ff'], water: ['#397fc1', '#28649e', '#6aa8df'],
  lava: ['#e45b24', '#a82e16', '#ffc02e'], leaves: ['#4d963f', '#36712f', '#71b752'],
  bookshelf: ['#84522f', '#5f351f', '#b57a45'], 'coal-ore': ['#777c7b', '#242727', '#a1a4a0'],
  'iron-ore': ['#777c7b', '#d0b9a1', '#a4a8a8'], 'gold-ore': ['#777c7b', '#f1c84b', '#a4a8a8'],
  'diamond-ore': ['#777c7b', '#49d6d2', '#a4a8a8'], 'emerald-ore': ['#777c7b', '#43c95a', '#a4a8a8'],
  'redstone-ore': ['#777c7b', '#df3e32', '#a4a8a8'], obsidian: ['#292544', '#17152c', '#413b66'],
};

function rgba(hex, alpha = 255) {
  return [...hex.slice(1).match(/../g).map(value => parseInt(value, 16)), alpha];
}
function pngFor(name, kind) {
  const palette = palettes[kind] ?? palettes.stone;
  const data = new Uint8Array(size * size * 4);
  const set = (x, y, color) => data.set(rgba(color), (y * size + x) * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, palette[0]);
  if (kind === 'planks' || kind === 'log') {
    for (let x = 2; x < size; x += 4) for (let y = 0; y < size; y++) set(x, y, palette[1]);
    for (let y = 3; y < size; y += 5) for (let x = 0; x < size; x++) set(x, y, palette[2]);
  } else if (kind === 'bricks' || kind === 'bookshelf') {
    for (let y = 0; y < size; y += 5) for (let x = 0; x < size; x++) set(x, y, palette[1]);
    for (let y = 1; y < size; y += 5) for (let x = (y % 2) * 4; x < size; x += 8) for (let yy = y; yy < Math.min(y + 4, size); yy++) set(x, yy, palette[1]);
  } else {
    for (let i = 0; i < 38; i++) {
      const x = (i * 37 + name.length * 11) % size;
      const y = (i * 19 + name.charCodeAt(0)) % size;
      const color = palette[(i + 1) % palette.length];
      set(x, y, color);
      if (i % 3 === 0) set((x + 1) % size, y, color);
    }
  }
  const raw = Buffer.from(data);
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    scanlines[y * (size * 4 + 1)] = 0;
    raw.copy(scanlines, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunk = (type, payload) => {
    const typeBytes = Buffer.from(type);
    const body = Buffer.concat([typeBytes, payload]);
    const crc = requireCrc32(body);
    const length = Buffer.alloc(4); length.writeUInt32BE(payload.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc >>> 0);
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const dimensions = Buffer.alloc(13); dimensions.writeUInt32BE(size, 0); dimensions.writeUInt32BE(size, 4); dimensions[8] = 8; dimensions[9] = 6;
  return Buffer.concat([header, chunk('IHDR', dimensions), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}
function requireCrc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}

mkdirSync(outputDir, { recursive: true });
const archive = {};
for (const [name, kind] of Object.entries(textures)) {
  const png = pngFor(name, kind);
  writeFileSync(`${outputDir}/${name}.png`, png);
  archive[`assets/minecraft/textures/block/${name}.png`] = new Uint8Array(png);
}
writeFileSync(zipPath, zipSync(archive, { level: 6 }));
console.log(`Generated ${Object.keys(textures).length} original default textures.`);
