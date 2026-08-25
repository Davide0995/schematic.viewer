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

export class TextureManager {
  constructor() {
    this._cache = new Map(); // texName → THREE.Texture
    this._raw   = new Map(); // texName → ImageBitmap (from pack)
    this._fallbacks = new Map(); // blockName → THREE.Texture
    this.loaded = false;
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
    if (this._raw.has(texName)) {
      tex = this._buildFromBitmap(texName, this._raw.get(texName));
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
