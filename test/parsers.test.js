import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'fflate';
import { parseNBT } from '../src/nbt.js';
import { parseSchematic } from '../src/schematic.js';
import { parseLitematic } from '../src/litematic.js';
import { resolveTextureAlias } from '../src/texture-manager.js';
import {
  blockStateProperties,
  parseResourcePackJson,
  resolveBlockModel,
  resolveBlockModels,
  resolveModel,
  selectBlockState,
} from '../src/resource-pack.js';

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

test('preserves classic schematic block entities with normalized coordinates', () => {
  const result = parseSchematic({
    value: {
      Width: 1,
      Height: 1,
      Length: 1,
      Blocks: new Int8Array([0]),
      TileEntities: [{ id: 'Sign', x: 0, y: 0, z: 0, Text1: 'Hello' }],
    },
  });

  assert.deepEqual(result.blockEntities, [{
    id: 'Sign', x: 0, y: 0, z: 0,
    data: { id: 'Sign', x: 0, y: 0, z: 0, Text1: 'Hello' },
  }]);
});

test('maps legacy colored shulker IDs instead of falling back to stone', () => {
  const result = parseSchematic({
    value: {
      Width: 2,
      Height: 1,
      Length: 1,
      Blocks: new Int8Array([220, 234]),
    },
  });

  assert.deepEqual(result.palette, [
    'minecraft:air',
    'minecraft:orange_shulker_box',
    'minecraft:black_shulker_box',
  ]);
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

  assert.equal(result.dataVersion, 3000);
  assert.deepEqual([result.width, result.height, result.length], [2, 1, 2]);
  assert.deepEqual(result.palette, [
    'minecraft:air',
    'minecraft:stone',
    'minecraft:oak_log[axis=y,waterlogged=false]',
  ]);
  assert.deepEqual([...result.blocks], [0, 1, 2, 1]);
});

test('unwraps metadata DataVersion values while decoding litematics', () => {
  const palette = [
    { Name: 'minecraft:air' },
    { Name: 'minecraft:stone' },
    { Name: 'minecraft:oak_planks' },
  ];

  const blockStates = blockStateLongs(0x000021); // entries: 1,2,0 with 4 bits each
  const result = parseLitematic({
    value: {
      Metadata: { MinecraftDataVersion: { value: 3000 } },
      Regions: {
        Main: litematicRegion({
          size: { x: 3, y: 1, z: 1 },
          palette,
          blockStates,
        }),
      },
    },
  });

  assert.equal(result.palette[result.blocks[0]], 'minecraft:stone');
  assert.equal(result.palette[result.blocks[1]], 'minecraft:oak_planks');
  assert.equal(result.palette[result.blocks[2]], 'minecraft:air');
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
  assert.equal(resolveTextureAlias('mossy_cobblestone'), 'cobblestone');
  assert.equal(resolveTextureAlias('polished_blackstone'), 'deepslate');
  assert.equal(resolveTextureAlias('light_blue_stained_glass'), 'blue_stained_glass');
  assert.equal(resolveTextureAlias('orange_wool'), 'red_stained_glass');
  assert.equal(resolveTextureAlias('oxidized_copper'), 'green_stained_glass');
  assert.equal(resolveTextureAlias('diamond_ore'), 'diamond_ore');
  assert.equal(resolveTextureAlias('mud_bricks'), 'bricks');
  assert.equal(resolveTextureAlias('spruce_leaves'), 'oak_leaves');
  assert.equal(resolveTextureAlias('unknown_block'), 'stone');
});

test('selects resource-pack blockstate variants by block properties', () => {
  const blockstates = new Map([['minecraft:test_block', {
    variants: {
      'facing=north': { model: 'minecraft:block/north' },
      'facing=east': { model: 'minecraft:block/east', y: 90 },
      '': { model: 'minecraft:block/default' },
    },
  }]]);

  assert.deepEqual(blockStateProperties('minecraft:test_block[facing=east]'), { facing: 'east' });
  assert.deepEqual(selectBlockState('minecraft:test_block[facing=east]', blockstates), [
    { model: 'minecraft:block/east', y: 90 },
  ]);
});

test('selects multipart blockstate models by conditions', () => {
  const blockstates = new Map([['minecraft:test_fence', {
    multipart: [
      { apply: { model: 'minecraft:block/post' } },
      { when: { north: 'true' }, apply: { model: 'minecraft:block/north' } },
      { when: { OR: [{ east: 'true' }, { west: 'true' }] }, apply: { model: 'minecraft:block/side' } },
      { when: { AND: [{ waterlogged: 'false' }, { south: 'true' }] }, apply: { model: 'minecraft:block/south' } },
    ],
  }]]);

  const models = new Map([
    ['minecraft:block/post', { elements: [] }],
    ['minecraft:block/north', { elements: [] }],
    ['minecraft:block/side', { elements: [] }],
    ['minecraft:block/south', { elements: [] }],
  ]);

  const selected = resolveBlockModels('minecraft:test_fence[north=true,east=true,south=true,waterlogged=false]', blockstates, models);
  assert.equal(selected.length, 4);
});

test('resolves resource-pack model parents and texture references', () => {
  const models = new Map([
    ['minecraft:block/cube', { elements: [{ from: [0, 0, 0], to: [16, 16, 16] }], textures: { all: 'minecraft:block/stone' } }],
    ['minecraft:block/child', { parent: 'minecraft:block/cube', textures: { base: 'minecraft:block/stone', all: '#base' } }],
  ]);

  const model = resolveModel('minecraft:block/child', models);

  assert.equal(model.elements.length, 1);
  assert.equal(model.textures.all, 'minecraft:block/stone');
});

test('resolves vanilla cube parents omitted by resource packs', () => {
  const models = new Map([
    ['minecraft:block/stone', { parent: 'minecraft:block/cube_all', textures: { all: 'minecraft:block/stone' } }],
  ]);
  const blockstates = new Map([
    ['minecraft:stone', { variants: { '': { model: 'minecraft:block/stone' } } }],
  ]);

  const model = resolveBlockModel('minecraft:stone', blockstates, models);

  assert.equal(model.elements.length, 1);
  assert.equal(model.elements[0].faces.up.texture, 'minecraft:block/stone');
});

test('parses blockstates and models from resource-pack paths', () => {
  const files = {
    'pack.mcmeta': new TextEncoder().encode('{"pack":{"pack_format":6}}'),
    'assets/minecraft/blockstates/stone.json': new TextEncoder().encode('{"variants":{"":{"model":"minecraft:block/stone"}}}'),
    'assets/minecraft/models/block/stone.json': new TextEncoder().encode('{"textures":{"all":"minecraft:block/stone"},"elements":[{"from":[0,0,0],"to":[16,16,16],"faces":{"up":{"texture":"#all"}}}]}'),
  };
  const parsed = parseResourcePackJson(files);
  const model = resolveBlockModel('minecraft:stone', parsed.blockstates, parsed.models);

  assert.ok(parsed.blockstates.has('minecraft:stone'));
  assert.ok(parsed.models.has('minecraft:block/stone'));
  assert.equal(parsed.packMeta.pack.pack_format, 6);
  assert.equal(model.textures.all, 'minecraft:block/stone');
  assert.equal(model.elements[0].faces.up.texture, 'minecraft:block/stone');
});
