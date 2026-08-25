import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'fflate';
import { parseNBT } from '../src/nbt.js';
import { parseSchematic } from '../src/schematic.js';
import { parseLitematic } from '../src/litematic.js';
import { resolveTextureAlias } from '../src/texture-manager.js';

function bytes(...values) {
  return new Uint8Array(values);
}

function writeU16(value) {
  return bytes(value >>> 8, value & 0xff);
}

function writeI32(value) {
  return bytes((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function writeString(value) {
  const encoded = new TextEncoder().encode(value);
  return new Uint8Array([...writeU16(encoded.length), ...encoded]);
}

function concat(...parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function namedTag(type, name, payload) {
  return concat(bytes(type), writeString(name), payload);
}

function intTag(name, value) {
  return namedTag(3, name, writeI32(value));
}

function stringTag(name, value) {
  return namedTag(8, name, writeString(value));
}

function compoundRoot(...tags) {
  return concat(bytes(10), writeString(''), ...tags, bytes(0));
}

function blockStateLongs(...lowWords) {
  const words = new Uint32Array(lowWords.length * 2);
  lowWords.forEach((lowWord, index) => { words[index * 2 + 1] = lowWord; });
  return words;
}

function litematicRegion({ position = { x: 0, y: 0, z: 0 }, size, palette, blockStates }) {
  return {
    Position: position,
    Size: size,
    BlockStatePalette: palette,
    BlockStates: blockStates,
  };
}

test('parses primitive NBT tags from an uncompressed compound', () => {
  const input = compoundRoot(
    intTag('Count', 42),
    stringTag('Name', 'test-structure'),
  );

  const result = parseNBT(input);

  assert.equal(result.name, '');
  assert.equal(result.value.Count, 42);
  assert.equal(result.value.Name, 'test-structure');
});

test('parses gzip-compressed NBT', () => {
  const input = compoundRoot(intTag('Width', 7));

  const result = parseNBT(gzipSync(input));

  assert.equal(result.value.Width, 7);
});

test('rejects truncated NBT data with a readable error', () => {
  assert.throws(() => parseNBT(bytes(10, 0)), /Unexpected end of NBT data/);
});

test('parses classic schematic dimensions, coordinates, and legacy block data', () => {
  const result = parseSchematic({
    value: {
      Width: 2,
      Height: 1,
      Length: 2,
      Blocks: new Int8Array([5, 35, 0, 12]),
      Data: new Int8Array([1, 14, 0, 1]),
    },
  });

  assert.deepEqual([result.width, result.height, result.length], [2, 1, 2]);
  assert.deepEqual(result.palette, [
    'minecraft:air',
    'minecraft:spruce_planks',
    'minecraft:red_wool',
    'minecraft:red_sand',
  ]);
  assert.deepEqual([...result.blocks], [1, 2, 0, 3]);
});

test('rejects classic schematics without a Blocks tag', () => {
  assert.throws(
    () => parseSchematic({ value: { Width: 1, Height: 1, Length: 1 } }),
    /No Blocks tag in schematic/,
  );
});

test('rejects invalid schematic dimensions and truncated arrays', () => {
  assert.throws(
    () => parseSchematic({ value: { Width: 0, Height: 1, Length: 1, Blocks: new Int8Array(0) } }),
    /Invalid schematic dimensions/,
  );
  assert.throws(
    () => parseSchematic({ value: { Width: 2, Height: 1, Length: 1, Blocks: new Int8Array([1]) } }),
    /Blocks tag is truncated/,
  );
});

test('decodes non-spanning litematic block states and properties', () => {
  const palette = [
    { Name: 'minecraft:air' },
    { Name: 'minecraft:stone' },
    { Name: 'minecraft:oak_log', Properties: { axis: 'y', waterlogged: 'false' } },
  ];
  // Four 4-bit entries: air, stone, oak_log, stone.
  const blockStates = blockStateLongs(0x1210);
  const result = parseLitematic({
    value: {
      Metadata: { MinecraftDataVersion: 3000 },
      Regions: {
        Main: litematicRegion({
          size: { x: 2, y: 1, z: 2 },
          palette,
          blockStates,
        }),
      },
    },
  });

  assert.deepEqual([result.width, result.height, result.length], [2, 1, 2]);
  assert.deepEqual(result.palette, [
    'minecraft:air',
    'minecraft:stone',
    'minecraft:oak_log[axis=y,waterlogged=false]',
  ]);
  assert.deepEqual([...result.blocks], [0, 1, 2, 1]);
});

test('merges litematic regions with negative positions', () => {
  const palette = [{ Name: 'minecraft:air' }, { Name: 'minecraft:stone' }];
  const result = parseLitematic({
    value: {
      Metadata: { MinecraftDataVersion: 3000 },
      Regions: {
        First: litematicRegion({
          position: { x: -1, y: 0, z: 0 },
          size: { x: 1, y: 1, z: 1 },
          palette,
          blockStates: blockStateLongs(0x1),
        }),
        Second: litematicRegion({
          position: { x: 0, y: 0, z: 0 },
          size: { x: 1, y: 1, z: 1 },
          palette,
          blockStates: blockStateLongs(0x0),
        }),
      },
    },
  });

  assert.deepEqual([result.width, result.height, result.length], [2, 1, 1]);
  assert.deepEqual([...result.blocks], [1, 0]);
});

test('rejects litematics without regions', () => {
  assert.throws(() => parseLitematic({ value: {} }), /Litematic has no regions/);
});

test('rejects litematic regions with truncated block states', () => {
  assert.throws(() => parseLitematic({
    value: {
      Metadata: { MinecraftDataVersion: 3000 },
      Regions: {
        Main: {
          Position: { x: 0, y: 0, z: 0 },
          Size: { x: 2, y: 1, z: 2 },
          BlockStatePalette: [{ Name: 'minecraft:air' }, { Name: 'minecraft:stone' }],
          BlockStates: new Uint32Array(0),
        },
      },
    },
  }), /BlockStates is truncated/);
});

test('decodes pre-1.16 spanning litematic entries', () => {
  const palette = Array.from({ length: 17 }, (_, index) => ({
    Name: index === 0 ? 'minecraft:air' : `minecraft:block_${index}`,
  }));
  // 17 entries use 5 bits each; entry 12 begins at bit 60 and spans longs.
  const blockStates = new Uint32Array(4);
  blockStates[0] = 12 << 28;
  blockStates[3] = 13 << 1;
  const result = parseLitematic({
    value: {
      Metadata: { MinecraftDataVersion: 2528 },
      Regions: {
        Main: litematicRegion({
          size: { x: 13, y: 1, z: 1 },
          palette,
          blockStates,
        }),
      },
    },
  });

  assert.equal(result.blocks[12], 12);
});

test('resolves missing block textures to recognizable material aliases', () => {
  assert.equal(resolveTextureAlias('crafting_table_front'), 'oak_planks');
  assert.equal(resolveTextureAlias('dark_oak_stairs'), 'dark_oak_planks');
  assert.equal(resolveTextureAlias('red_sandstone_side'), 'sandstone');
  assert.equal(resolveTextureAlias('water'), 'water_still');
  assert.equal(resolveTextureAlias('unknown_block'), null);
});
