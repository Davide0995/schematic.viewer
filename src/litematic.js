// Parses .litematic files (Litematica mod format)
// Returns { width, height, length, palette, blocks }
// blocks is Uint32Array indexed [x + z*width + y*width*length] = palette index

function getBitsFromLongs(longs, longIndex, bitOffset, bits) {
  // longs is Uint32Array storing BigInt64 values as [hi0,lo0, hi1,lo1,...]
  const hiIdx = longIndex * 2;
  const loIdx = longIndex * 2 + 1;
  const hi = longs[hiIdx];
  const lo = longs[loIdx];
  // Extract bits from the 64-bit value (hi=upper 32, lo=lower 32)
  const mask = bits === 32 ? 0xFFFFFFFF : (1 << bits) - 1;
  if (bitOffset < 32) {
    if (bitOffset + bits <= 32) {
      return (lo >>> bitOffset) & mask;
    } else {
      // Spans lo and hi
      const fromLo = lo >>> bitOffset;
      const bitsFromLo = 32 - bitOffset;
      const bitsFromHi = bits - bitsFromLo;
      const fromHi = hi & ((1 << bitsFromHi) - 1);
      return fromLo | (fromHi << bitsFromLo);
    }
  } else {
    const offset = bitOffset - 32;
    return (hi >>> offset) & mask;
  }
}

function unpackBlocks(blockStates, paletteSize, totalBlocks, nonSpanning) {
  const bits = Math.max(2, Math.ceil(Math.log2(paletteSize || 1)));
  const bitsPerEntry = Math.max(4, bits);
  const out = new Uint32Array(totalBlocks);

  if (nonSpanning) {
    // 1.16+ format: each long contains only complete entries
    const valuesPerLong = Math.floor(64 / bitsPerEntry);
    for (let i = 0; i < totalBlocks; i++) {
      const longIdx = Math.floor(i / valuesPerLong);
      const bitOffset = (i % valuesPerLong) * bitsPerEntry;
      out[i] = getBitsFromLongs(blockStates, longIdx, bitOffset, bitsPerEntry);
    }
  } else {
    // Pre-1.16 format: entries can span longs
    for (let i = 0; i < totalBlocks; i++) {
      const bitStart = i * bitsPerEntry;
      const longIdx = Math.floor(bitStart / 64);
      const bitOffset = bitStart % 64;
      if (bitOffset + bitsPerEntry <= 64) {
        out[i] = getBitsFromLongs(blockStates, longIdx, bitOffset, bitsPerEntry);
      } else {
        // Spans two longs
        const bitsFirst = 64 - bitOffset;
        const bitsSecond = bitsPerEntry - bitsFirst;
        const fromFirst = getBitsFromLongs(blockStates, longIdx, bitOffset, bitsFirst);
        const fromSecond = getBitsFromLongs(blockStates, longIdx + 1, 0, bitsSecond);
        out[i] = fromFirst | (fromSecond << bitsFirst);
      }
    }
  }
  return out;
}

const MAX_BLOCKS = 64 * 1024 * 1024;

function validateRegionValue(value, name, allowZero = true) {
  if (!Number.isInteger(value) || (!allowZero && value === 0)) {
    throw new Error(`Invalid litematic ${name}`);
  }
  return value;
}

export function parseLitematic(nbt) {
  const root = nbt.value;
  const meta = root['Metadata'] ?? root['metadata'];
  const regions = root['Regions'] ?? root['regions'];
  if (!regions || typeof regions !== 'object' || Object.keys(regions).length === 0) {
    throw new Error('Litematic has no regions');
  }

  // Collect all regions and merge into one volume
  const regionNames = Object.keys(regions);
  const allRegions = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const rName of regionNames) {
    const r = regions[rName];
    const pos = r['Position'] ?? { x: {value:0}, y: {value:0}, z: {value:0} };
    const size = r['Size'];
    if (!size) throw new Error('Litematic region has no size');
    const rx = typeof pos.x === 'object' ? pos.x.value ?? pos.x : pos.x;
    const ry = typeof pos.y === 'object' ? pos.y.value ?? pos.y : pos.y;
    const rz = typeof pos.z === 'object' ? pos.z.value ?? pos.z : pos.z;
    const sx = typeof size.x === 'object' ? size.x.value ?? size.x : size.x;
    const sy = typeof size.y === 'object' ? size.y.value ?? size.y : size.y;
    const sz = typeof size.z === 'object' ? size.z.value ?? size.z : size.z;
    validateRegionValue(rx, 'region position');
    validateRegionValue(ry, 'region position');
    validateRegionValue(rz, 'region position');
    validateRegionValue(sx, 'region size', false);
    validateRegionValue(sy, 'region size', false);
    validateRegionValue(sz, 'region size', false);
    if (Math.abs(sx) * Math.abs(sy) * Math.abs(sz) > MAX_BLOCKS) {
      throw new Error('Litematic region is too large to load');
    }
    const px = Math.min(rx, rx + sx); const ex = Math.max(rx, rx + sx);
    const py = Math.min(ry, ry + sy); const ey = Math.max(ry, ry + sy);
    const pz = Math.min(rz, rz + sz); const ez = Math.max(rz, rz + sz);
    minX = Math.min(minX, px); minY = Math.min(minY, py); minZ = Math.min(minZ, pz);
    maxX = Math.max(maxX, ex); maxY = Math.max(maxY, ey); maxZ = Math.max(maxZ, ez);
    allRegions.push({ r, px, py, pz, sizeX: Math.abs(sx), sizeY: Math.abs(sy), sizeZ: Math.abs(sz) });
  }

  const width  = maxX - minX || 1;
  const height = maxY - minY || 1;
  const length = maxZ - minZ || 1;
  if (width * height * length > MAX_BLOCKS) throw new Error('Litematic is too large to load');

  // Build merged palette and block array
  const globalPalette = ['minecraft:air'];
  const paletteMap = new Map([['minecraft:air', 0]]);
  const blocks = new Uint32Array(width * height * length); // all air by default

  // Detect format version for spanning vs non-spanning
  const dataVersion = meta?.['MinecraftDataVersion'] ?? meta?.['DataVersion'] ?? 0;
  const nonSpanning = dataVersion >= 2529; // 1.16+

  for (const { r, px, py, pz, sizeX, sizeY, sizeZ } of allRegions) {
    const palette = r['BlockStatePalette'] ?? r['Palette'] ?? [];
    const blockStates = r['BlockStates'];
    if (!blockStates) continue;
    if (!Array.isArray(palette) || palette.length === 0) throw new Error('Litematic region has no palette');

    // Build local palette as block name strings
    const localPalette = palette.map(entry => {
      const name = entry['Name'] ?? 'minecraft:air';
      const props = entry['Properties'];
      if (!props) return name;
      const propsStr = Object.entries(props).sort(([a],[b]) => a.localeCompare(b))
        .map(([k,v]) => `${k}=${v}`).join(',');
      return propsStr ? `${name}[${propsStr}]` : name;
    });

    // Map local palette to global palette
    const localToGlobal = new Uint32Array(localPalette.length);
    for (let i = 0; i < localPalette.length; i++) {
      const s = localPalette[i];
      if (!paletteMap.has(s)) { paletteMap.set(s, globalPalette.length); globalPalette.push(s); }
      localToGlobal[i] = paletteMap.get(s);
    }

    const totalBlocks = sizeX * sizeY * sizeZ;
    let localBlocks;
    try {
      localBlocks = unpackBlocks(blockStates, localPalette.length, totalBlocks, nonSpanning);
      // Validate — if any index is out of range, try other format
      let invalid = false;
      for (let i = 0; i < Math.min(1000, totalBlocks); i++) {
        if (localBlocks[i] >= localPalette.length) { invalid = true; break; }
      }
      if (invalid) {
        localBlocks = unpackBlocks(blockStates, localPalette.length, totalBlocks, !nonSpanning);
      }
    } catch {
      continue;
    }

    // Copy into global block array
    for (let ly = 0; ly < sizeY; ly++) {
      const gy = py - minY + ly;
      if (gy < 0 || gy >= height) continue;
      for (let lz = 0; lz < sizeZ; lz++) {
        const gz = pz - minZ + lz;
        if (gz < 0 || gz >= length) continue;
        for (let lx = 0; lx < sizeX; lx++) {
          const gx = px - minX + lx;
          if (gx < 0 || gx >= width) continue;
          const localIdx = ly * sizeZ * sizeX + lz * sizeX + lx;
          const paletteIdx = localBlocks[localIdx];
          if (paletteIdx >= localPalette.length) continue;
          const globalIdx = gx + gz * width + gy * width * length;
          blocks[globalIdx] = localToGlobal[paletteIdx];
        }
      }
    }
  }

  return { width, height, length, palette: globalPalette, blocks };
}
