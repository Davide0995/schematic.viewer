import * as THREE from 'three';
import { unzip } from 'fflate';
import { blockNameToColor, getTextureTint } from './block-registry.js';

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
};

export function resolveTextureAlias(texName) {
  if (TEXTURE_ALIASES[texName]) return TEXTURE_ALIASES[texName];
  const base = texName.replace(/_(top|side|bottom|front|back)$/, '');
  if (TEXTURE_ALIASES[base]) return TEXTURE_ALIASES[base];
  if (/(slab|stairs|fence|fence_gate|door|trapdoor)$/.test(base)) {
    const material = base.match(/^(oak|spruce|birch|jungle|acacia|dark_oak)_/);
    return material ? `${material[1]}_planks` : 'stone';
  }
  if (/(brick|terracotta|concrete|wool)$/.test(base)) return 'stone';
  return null;
}

export class TextureManager {
  constructor() {
    this._cache = new Map(); // texName → THREE.Texture
    this._raw   = new Map(); // texName → ImageBitmap (from pack)
    this._fallbacks = new Map(); // blockName → THREE.Texture
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

        const blockTexPrefix = 'assets/minecraft/textures/block/';
        const entries = Object.entries(files).filter(([name]) =>
          name.startsWith(blockTexPrefix) && name.endsWith('.png')
        );
        const promises = entries.map(async ([path, data]) => {
          const texName = path.slice(blockTexPrefix.length).replace(/\.png$/, '');
          try {
            const bitmap = await blobToImageBitmap(new Blob([data], { type: 'image/png' }));
            this._raw.set(texName, bitmap);
          } catch {}
        });

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
    for (const texture of this._cache.values()) texture.dispose();
    this._cache.clear();
    return this._readZip(bytes);
  }

  _buildFromBitmap(texName, bitmap) {
    const tint = getTextureTint(texName);
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
    const resolvedName = this._raw.has(texName) ? texName : resolveTextureAlias(texName);
    if (resolvedName && this._raw.has(resolvedName)) {
      tex = this._buildFromBitmap(resolvedName, this._raw.get(resolvedName));
    } else {
      tex = nearestFilter(new THREE.CanvasTexture(colorCanvas(blockNameToColor(texName))));
    }
    this._cache.set(texName, tex);
    return tex;
  }

  getFallbackForBlock(blockName, texName = blockName) {
    const fallbackKey = `${blockName}:${texName}`;
    if (this._fallbacks.has(fallbackKey)) return this._fallbacks.get(fallbackKey);
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
