import * as THREE from 'three';
import { unzip } from 'fflate';
import { blockNameToColor, getTextureTint } from './block-registry.js';
import { parseResourcePackJson, resolveBlockModel, resolveBlockModels } from './resource-pack.js';

function nearestFilter(tex) {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

async function blobToImageBitmap(blob) {
  return createImageBitmap(blob, { colorSpaceConversion: 'none' });
}

function applyTint(imageBitmap, tint) {
  const canvas = document.createElement('canvas');
  canvas.width  = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  const [tr, tg, tb] = tint;
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = Math.round(d[i]   * tr);
    d[i+1] = Math.round(d[i+1] * tg);
    d[i+2] = Math.round(d[i+2] * tb);
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function colorCanvas(color, w=16, h=16) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  // Subtle edge darkening to distinguish blocks
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, w, 1);
  ctx.fillRect(0, 0, 1, h);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(w-1, 0, 1, h);
  ctx.fillRect(0, h-1, w, 1);
  return c;
}

function missingTextureCanvas(w = 16, h = 16) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const halfW = Math.max(1, Math.floor(w / 2));
  const halfH = Math.max(1, Math.floor(h / 2));
  ctx.fillStyle = '#ff00ff';
  ctx.fillRect(0, 0, halfW, halfH);
  ctx.fillRect(halfW, halfH, w - halfW, h - halfH);
  ctx.fillStyle = '#111111';
  ctx.fillRect(halfW, 0, w - halfW, halfH);
  ctx.fillRect(0, halfH, halfW, h - halfH);
  return c;
}

const TEXTURE_ALIASES = {
  grass: 'grass_block_top',
  grass_block: 'grass_block_side',
  grass_block_side: 'grass_block_side',
  mycelium_top: 'grass_block_top',
  mycelium_side: 'grass_block_side',
  podzol_top: 'grass_block_top',
  podzol_side: 'grass_block_side',
  dirt_path_top: 'dirt_path_top',
  dirt_path_side: 'dirt_path_side',
  oak_planks: 'oak_planks',
  crafting_table_top: 'oak_planks',
  crafting_table_front: 'oak_planks',
  crafting_table_side: 'oak_planks',
  bookshelf: 'bookshelf',
  chest_top: 'oak_planks',
  chest_front: 'oak_planks',
  chest_side: 'oak_planks',
  chest_bottom: 'oak_planks',
  ender_chest_top: 'obsidian',
  ender_chest_front: 'obsidian',
  ender_chest_side: 'obsidian',
  ender_chest_bottom: 'obsidian',
  stone_brick: 'stone_bricks',
  stone_bricks: 'stone_bricks',
  smooth_stone: 'stone',
  deepslate: 'stone',
  deepslate_top: 'stone',
  polished_basalt: 'stone',
  basalt: 'stone',
  netherrack: 'stone',
  sandstone: 'sandstone',
  sandstone_top: 'sandstone_top',
  sandstone_bottom: 'sandstone_bottom',
  red_sandstone: 'sandstone',
  red_sandstone_top: 'sandstone_top',
  red_sandstone_bottom: 'sandstone_bottom',
  quartz_block: 'stone',
  quartz_block_top: 'stone',
  quartz_block_side: 'stone',
  quartz_block_bottom: 'stone',
  furnace_front: 'furnace_front',
  furnace_side: 'furnace_side',
  furnace_top: 'furnace_top',
  furnace_bottom: 'furnace_bottom',
  blast_furnace_front: 'furnace_front',
  blast_furnace_side: 'furnace_side',
  blast_furnace_top: 'furnace_top',
  smoker_front: 'furnace_front',
  smoker_side: 'furnace_side',
  smoker_top: 'furnace_top',
  water: 'water_still',
  lava: 'lava_still',
  magma: 'lava_still',
  packed_ice: 'ice',
  blue_ice: 'ice',
  sponge: 'sand',
  wet_sponge: 'sand',
  moss_block: 'grass_block_side',
  mossy_cobblestone: 'cobblestone',
  cracked_stone_bricks: 'stone_bricks',
  mossy_stone_bricks: 'stone_bricks',
  chiseled_stone_bricks: 'stone_bricks',
  polished_deepslate: 'deepslate',
  blackstone: 'deepslate',
  polished_blackstone: 'deepslate',
  netherrack: 'stone',
  nether_bricks: 'stone_bricks',
  red_nether_bricks: 'bricks',
  quartz_block: 'stone',
  quartz_block_top: 'stone',
  quartz_block_side: 'stone',
  quartz_block_bottom: 'stone',
  prismarine: 'stone',
  prismarine_bricks: 'stone_bricks',
  dark_prismarine: 'deepslate',
  amethyst_block: 'purple_stained_glass',
  pumpkin_top: 'sand',
  pumpkin_side: 'sand',
  melon_top: 'grass_block_top',
  melon_side: 'grass_block_side',
  hay_block_top: 'oak_planks',
  hay_block_side: 'oak_planks',
  copper_block: 'gold_block',
  exposed_copper: 'gold_block',
  weathered_copper: 'green_stained_glass',
  oxidized_copper: 'green_stained_glass',
  light_blue_stained_glass: 'blue_stained_glass',
  cyan_stained_glass: 'blue_stained_glass',
  lime_stained_glass: 'green_stained_glass',
  magenta_stained_glass: 'purple_stained_glass',
  orange_stained_glass: 'red_stained_glass',
  pink_stained_glass: 'red_stained_glass',
  gray_stained_glass: 'black_stained_glass',
  light_gray_stained_glass: 'white_stained_glass',
  brown_stained_glass: 'red_stained_glass',
  yellow_stained_glass: 'yellow_stained_glass',
  light_blue_wool: 'blue_stained_glass',
  cyan_wool: 'blue_stained_glass',
  lime_wool: 'green_stained_glass',
  magenta_wool: 'purple_stained_glass',
  orange_wool: 'red_stained_glass',
  pink_wool: 'red_stained_glass',
  gray_wool: 'black_stained_glass',
  light_gray_wool: 'white_stained_glass',
  brown_wool: 'red_stained_glass',
  yellow_wool: 'yellow_stained_glass',
};

export function resolveTextureAlias(texName) {
  if (TEXTURE_ALIASES[texName]) return TEXTURE_ALIASES[texName];
  const base = texName.replace(/_(top|side|bottom|front|back)$/, '');
  if (TEXTURE_ALIASES[base]) return TEXTURE_ALIASES[base];

  const colorAliases = {
    black: 'black_stained_glass', gray: 'black_stained_glass',
    light_gray: 'white_stained_glass', white: 'white_stained_glass',
    brown: 'red_stained_glass', red: 'red_stained_glass',
    orange: 'red_stained_glass', pink: 'red_stained_glass',
    yellow: 'yellow_stained_glass', lime: 'green_stained_glass',
    green: 'green_stained_glass', cyan: 'blue_stained_glass',
    light_blue: 'blue_stained_glass', blue: 'blue_stained_glass',
    purple: 'purple_stained_glass', magenta: 'purple_stained_glass',
  };
  const color = Object.keys(colorAliases).find(name => base.startsWith(`${name}_`));
  if (color && /(wool|concrete|terracotta|carpet|glass|glazed_terracotta)/.test(base)) {
    return colorAliases[color];
  }

  if (/(slab|stairs|fence|fence_gate|door|trapdoor)$/.test(base)) {
    const material = base.match(/^(oak|spruce|birch|jungle|acacia|dark_oak)_/);
    return material ? `${material[1]}_planks` : 'stone';
  }

  const families = [
    [/water|kelp|seagrass|lily_pad/, 'water_still'],
    [/lava|magma/, 'lava_still'],
    [/glass|ice/, 'glass'],
    [/coal/, 'coal_ore'],
    [/iron/, 'iron_ore'],
    [/gold/, 'gold_ore'],
    [/diamond/, 'diamond_ore'],
    [/emerald/, 'emerald_ore'],
    [/redstone/, 'redstone_ore'],
    [/lapis/, 'lapis_ore'],
    [/ore/, 'stone'],
    [/brick/, 'bricks'],
    [/sandstone|sand/, 'sand'],
    [/gravel/, 'gravel'],
    [/dirt|mud|farmland/, 'dirt'],
    [/grass|moss|azalea/, 'grass_block_side'],
    [/leaves|vine|bush|flower|plant|sapling/, 'oak_leaves'],
    [/log|wood|planks/, 'oak_planks'],
    [/terracotta|concrete|wool|carpet/, 'stone'],
    [/quartz|prismarine|purpur|netherrack|nether/, 'stone'],
    [/copper/, 'gold_block'],
    [/cobble|stone|andesite|diorite|granite|deepslate|blackstone/, 'stone'],
    [/torch|lantern|light|glow/, 'torch'],
    [/rail|ladder/, 'rail'],
    [/tnt/, 'tnt_side'],
    [/furnace|smoker|dispenser|dropper/, 'furnace_side'],
  ];
  return families.find(([pattern]) => pattern.test(base))?.[1] ?? 'stone';
}

function canonicalTextureId(texName) {
  if (!texName) return null;
  const [namespacePart, pathPart] = texName.includes(':')
    ? texName.split(':', 2)
    : ['minecraft', texName];

  let path = pathPart;
  if (path.startsWith('textures/')) path = path.slice('textures/'.length);
  if (path.startsWith('block/')) path = path.slice('block/'.length);
  if (path.startsWith('blocks/')) path = path.slice('blocks/'.length);
  return `${namespacePart}:${path}`;
}

function textureCandidates(texName) {
  const normalized = canonicalTextureId(texName);
  const [namespace, path] = normalized.split(':', 2);
  const prefixed = `${namespace}:block/${path}`;
  return [...new Set([normalized, prefixed, `minecraft:${path}`, `minecraft:block/${path}`])];
}

export class TextureManager {
  constructor() {
    this._cache = new Map(); // texName → THREE.Texture
    this._raw   = new Map(); // texName → ImageBitmap (from pack)
    this._blockstates = new Map();
    this._models = new Map();
    this._fallbacks = new Map(); // blockName → THREE.Texture
    this._usingUserPack = false;
    this.loaded = false;
    this.ready = this.loadDefaultPack();
  }

  async loadDefaultPack() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}default-textures.zip`);
      if (!response.ok) throw new Error(`Default texture pack request failed: ${response.status}`);
      await this._readZip(new Uint8Array(await response.arrayBuffer()));
    } catch (error) {
      console.warn('Default texture pack unavailable; using color fallbacks.', error);
    }
  }

  async _readZip(bytes) {
    return new Promise((resolve, reject) => {
      unzip(bytes, (err, files) => {
        if (err) { reject(err); return; }

        const entries = Object.entries(files).filter(([name]) =>
          /^assets\/[^/]+\/textures\/(?:block|blocks)\/.+\.png$/i.test(name)
        );
        const promises = entries.map(async ([path, data]) => {
          const match = path.match(/^assets\/([^/]+)\/textures\/(?:block|blocks)\/(.+)\.png$/i);
          if (!match) return;
          const texName = `${match[1]}:${match[2]}`;
          try {
            const bitmap = await blobToImageBitmap(new Blob([data], { type: 'image/png' }));
            this._raw.set(texName, bitmap);
          } catch {}
        });

        const json = parseResourcePackJson(files);
        for (const [key, value] of json.blockstates) this._blockstates.set(key, value);
        for (const [key, value] of json.models) this._models.set(key, value);

        Promise.all(promises).then(() => {
          this.loaded = this._raw.size > 0;
          this._cache.clear();
          resolve(this._raw.size);
        });
      });
    });
  }

  async loadFromZip(file) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);

    await this.ready;
    for (const bitmap of this._raw.values()) bitmap.close?.();
    this._raw.clear();
    this._blockstates.clear();
    this._models.clear();
    for (const texture of this._cache.values()) texture.dispose();
    this._cache.clear();
    this._usingUserPack = true;
    return this._readZip(bytes);
  }

  getBlockModel(blockName) {
    return resolveBlockModel(blockName, this._blockstates, this._models);
  }

  getBlockModels(blockName) {
    return resolveBlockModels(blockName, this._blockstates, this._models);
  }

  _buildFromBitmap(texName, bitmap) {
    const tint = getTextureTint(texName.split(':')[1]);
    let source;
    if (tint) {
      source = applyTint(bitmap, tint);
    } else {
      // Use first frame only (for animated textures, the PNG is a vertical strip)
      const size = bitmap.width; // should be 16 (or 32, 64...)
      if (bitmap.height > size) {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        c.getContext('2d').drawImage(bitmap, 0, 0, size, size, 0, 0, size, size);
        source = c;
      } else {
        source = bitmap;
      }
    }
    const tex = new THREE.CanvasTexture(source);
    return nearestFilter(tex);
  }

  getTexture(texName) {
    if (this._cache.has(texName)) return this._cache.get(texName);

    let tex;
    const [normalizedName, shortName] = [canonicalTextureId(texName), canonicalTextureId(texName).split(':')[1]];
    const exact = textureCandidates(normalizedName).find(candidate => this._raw.has(candidate));
    if (exact) {
      tex = this._buildFromBitmap(exact, this._raw.get(exact));
    } else if (!this._usingUserPack) {
      // For the bundled partial pack, avoid collapsing unknown textures to stone-like aliases.
      tex = nearestFilter(new THREE.CanvasTexture(colorCanvas(blockNameToColor(shortName))));
    } else {
      tex = nearestFilter(new THREE.CanvasTexture(missingTextureCanvas()));
    }
    this._cache.set(texName, tex);
    return tex;
  }

  getFallbackForBlock(blockName, texName = blockName) {
    const fallbackKey = `${blockName}:${texName}`;
    if (this._fallbacks.has(fallbackKey)) return this._fallbacks.get(fallbackKey);
    const shortName = canonicalTextureId(texName).split(':')[1];
    const resolvedName = resolveTextureAlias(shortName);
    if (resolvedName && this._raw.has(`minecraft:${resolvedName}`)) {
      return this.getTexture(`minecraft:${resolvedName}`);
    }
    const color = blockNameToColor(blockName);
    const tex = nearestFilter(new THREE.CanvasTexture(colorCanvas(color)));
    this._fallbacks.set(fallbackKey, tex);
    return tex;
  }

  // Resolve a texture name to a THREE.Texture, using fallback color if needed
  resolve(texName, blockName) {
    if (this.loaded) return this.getTexture(texName);
    return this.getFallbackForBlock(blockName, texName);
  }

  dispose() {
    for (const tex of this._cache.values()) tex.dispose();
    for (const tex of this._fallbacks.values()) tex.dispose();
    this._cache.clear();
    this._fallbacks.clear();
    this._raw.clear();
    this.loaded = false;
  }
}
