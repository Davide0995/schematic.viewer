// Maps block names → face textures and opacity

// Blocks that don't cull adjacent block faces (non-opaque)
const NON_OPAQUE_PATTERNS = [
  'air', 'water', 'lava', 'glass', 'leaves', '_door', '_slab', '_stairs',
  '_fence', '_wall', '_bars', '_pane', 'torch', '_sign', 'banner', '_bed',
  '_button', '_pressure_plate', '_carpet', '_trapdoor', '_sapling', '_plant',
  'dandelion', 'poppy', 'orchid', 'allium', 'bluet', 'tulip', 'daisy',
  'cornflower', 'lily_of', 'wither_rose', 'wheat', 'carrots', 'potatoes',
  'beetroot', 'sugar_cane', 'bamboo', 'cactus', 'vine', 'nether_wart',
  'lily_pad', 'sea_pickle', 'kelp', 'seagrass', 'coral', 'mushroom',
  'rail', 'ladder', 'redstone_wire', 'lever', 'tripwire', 'end_rod',
  'ice', 'frosted_ice', 'honey_block', 'slime_block', 'cobweb',
  'chorus', 'grass', 'dead_bush', 'sunflower', 'rose_bush',
];

export function isOpaque(blockName) {
  if (!blockName || blockName === 'minecraft:air') return false;
  const short = blockName.replace('minecraft:', '').split('[')[0];
  for (const p of NON_OPAQUE_PATTERNS) {
    if (short.includes(p)) return false;
  }
  return true;
}

// Bi-directional: if texture name matches block name, no entry needed.
// Only override when faces differ or name needs to be specified explicitly.
const SPECIAL_FACES = {
  'grass_block':          { top: 'grass_block_top', side: 'grass_block_side', bottom: 'dirt' },
  'mycelium':             { top: 'mycelium_top', side: 'mycelium_side', bottom: 'dirt' },
  'podzol':               { top: 'podzol_top', side: 'podzol_side', bottom: 'dirt' },
  'crimson_nylium':       { top: 'crimson_nylium', side: 'netherrack', bottom: 'netherrack' },
  'warped_nylium':        { top: 'warped_nylium', side: 'netherrack', bottom: 'netherrack' },
  'dirt_path':            { top: 'dirt_path_top', side: 'dirt_path_side', bottom: 'dirt' },
  'grass_path':           { top: 'dirt_path_top', side: 'dirt_path_side', bottom: 'dirt' },
  'tnt':                  { top: 'tnt_top', side: 'tnt_side', bottom: 'tnt_bottom' },
  'bookshelf':            { top: 'oak_planks', side: 'bookshelf', bottom: 'oak_planks' },
  'sandstone':            { top: 'sandstone_top', side: 'sandstone', bottom: 'sandstone_bottom' },
  'red_sandstone':        { top: 'red_sandstone_top', side: 'red_sandstone', bottom: 'red_sandstone_bottom' },
  'chiseled_sandstone':   { top: 'sandstone_top', side: 'chiseled_sandstone', bottom: 'sandstone_bottom' },
  'smooth_sandstone':     { all: 'sandstone_top' },
  'hay_block':            { top: 'hay_block_top', side: 'hay_block_side' },
  'bone_block':           { top: 'bone_block_top', side: 'bone_block_side' },
  'pumpkin':              { top: 'pumpkin_top', side: 'pumpkin_side' },
  'carved_pumpkin':       { top: 'pumpkin_top', north: 'carved_pumpkin', side: 'pumpkin_side' },
  'jack_o_lantern':       { top: 'pumpkin_top', north: 'jack_o_lantern', side: 'pumpkin_side' },
  'melon':                { top: 'melon_top', side: 'melon_side' },
  'basalt':               { top: 'basalt_top', side: 'basalt_side' },
  'polished_basalt':      { top: 'polished_basalt_top', side: 'polished_basalt_side' },
  'deepslate':            { top: 'deepslate_top', side: 'deepslate', bottom: 'deepslate_top' },
  'furnace':              { top: 'furnace_top', north: 'furnace_front', side: 'furnace_side', bottom: 'furnace_top' },
  'blast_furnace':        { top: 'blast_furnace_top', north: 'blast_furnace_front', side: 'blast_furnace_side', bottom: 'blast_furnace_top' },
  'smoker':               { top: 'smoker_top', north: 'smoker_front', side: 'smoker_side', bottom: 'smoker_bottom' },
  'observer':             { top: 'observer_top', north: 'observer_face', south: 'observer_back', side: 'observer_side' },
  'redstone_wire':        { all: 'redstone_dust_dot' },
  'redstone_torch':       { all: 'redstone_torch' },
  'repeater':             { all: 'repeater' },
  'comparator':           { all: 'comparator' },
  'lever':                { all: 'lever' },
  'tripwire_hook':        { all: 'tripwire_hook' },
  'rail':                 { all: 'rail' },
  'powered_rail':         { all: 'powered_rail' },
  'detector_rail':        { all: 'detector_rail' },
  'activator_rail':       { all: 'activator_rail' },
  'piston':               { top: 'piston_top', side: 'piston_side', bottom: 'piston_bottom' },
  'sticky_piston':        { top: 'piston_top_sticky', side: 'piston_side', bottom: 'piston_bottom' },
  'dispenser':            { top: 'furnace_top', north: 'dispenser_front', side: 'furnace_side', bottom: 'furnace_top' },
  'dropper':              { top: 'furnace_top', north: 'dropper_front', side: 'furnace_side', bottom: 'furnace_top' },
  'crafting_table':       { top: 'crafting_table_top', north: 'crafting_table_front', east: 'crafting_table_side', south: 'crafting_table_front', west: 'crafting_table_side', bottom: 'oak_planks' },
  'chest':                { top: 'chest_top', north: 'chest_front', side: 'chest_side', bottom: 'chest_bottom' },
  'ender_chest':          { top: 'ender_chest_top', north: 'ender_chest_front', side: 'ender_chest_side', bottom: 'ender_chest_bottom' },
  'grass':                { all: 'grass' },
  'command_block':        { all: 'command_block_side' },
  'repeating_command_block': { all: 'repeating_command_block_side' },
  'chain_command_block':  { all: 'chain_command_block_side' },
  'stone':                { all: 'stone' },
  'farmland':             { top: 'farmland_moist', side: 'dirt', bottom: 'dirt' },
  'snow_block':           { all: 'snow' },
  'ice':                  { all: 'ice' },
  'packed_ice':           { all: 'packed_ice' },
  'blue_ice':             { all: 'blue_ice' },
  'glowstone':            { all: 'glowstone' },
  'sea_lantern':          { all: 'sea_lantern' },
  'magma_block':          { all: 'magma' },
  'redstone_lamp':        { all: 'redstone_lamp' },
  'jukebox':              { top: 'jukebox_top', side: 'jukebox_side' },
  'note_block':           { all: 'note_block' },
  'sponge':               { all: 'sponge' },
  'wet_sponge':           { all: 'wet_sponge' },
  'spawner':              { all: 'spawner' },
  'dragon_egg':           { all: 'dragon_egg' },
  'beacon':               { top: 'beacon', side: 'beacon', bottom: 'obsidian' },
};

// Wood log variants
for (const w of ['oak','spruce','birch','jungle','acacia','dark_oak','crimson','warped','mangrove','cherry','bamboo']) {
  SPECIAL_FACES[`${w}_log`]       = { top: `${w}_log_top`, side: `${w}_log` };
  SPECIAL_FACES[`stripped_${w}_log`] = { top: `stripped_${w}_log_top`, side: `stripped_${w}_log` };
  SPECIAL_FACES[`${w}_wood`]      = { all: `${w}_log` };
  SPECIAL_FACES[`stripped_${w}_wood`] = { all: `stripped_${w}_log` };
}

// Mushroom blocks
for (const m of ['brown','red']) {
  SPECIAL_FACES[`${m}_mushroom_block`] = { all: `${m}_mushroom_block` };
}

// Quartz
SPECIAL_FACES['quartz_block']     = { top: 'quartz_block_top', side: 'quartz_block_side', bottom: 'quartz_block_bottom' };
SPECIAL_FACES['quartz_pillar']    = { top: 'quartz_pillar_top', side: 'quartz_pillar' };
SPECIAL_FACES['chiseled_quartz_block'] = { top: 'chiseled_quartz_block_top', side: 'chiseled_quartz_block' };

// Purpur
SPECIAL_FACES['purpur_pillar']    = { top: 'purpur_pillar_top', side: 'purpur_pillar' };

/**
 * Returns texture paths for each face of a block.
 * Keys: top, bottom, north, south, east, west (and 'all' as shorthand).
 * Values are texture names relative to assets/minecraft/textures/block/ (no .png).
 */
export function getBlockFaceTextures(blockName) {
  // Strip namespace and block state properties
  const base = blockName.replace('minecraft:', '').split('[')[0];

  if (SPECIAL_FACES[base]) {
    const s = SPECIAL_FACES[base];
    return {
      top:    s.top    ?? s.side ?? s.all ?? base,
      bottom: s.bottom ?? s.side ?? s.all ?? base,
      north:  s.north  ?? s.side ?? s.all ?? base,
      south:  s.south  ?? s.side ?? s.all ?? base,
      east:   s.east   ?? s.side ?? s.all ?? base,
      west:   s.west   ?? s.side ?? s.all ?? base,
    };
  }

  // Default: all faces use the block's own texture name
  return { top: base, bottom: base, north: base, south: base, east: base, west: base };
}

// Blocks that should receive grass/foliage/water tinting
const GRASS_TINT   = new Set(['grass_block_top', 'grass_block_side', 'grass', 'fern', 'tall_grass', 'large_fern']);
const FOLIAGE_TINT = new Set(['oak_leaves', 'spruce_leaves', 'birch_leaves', 'jungle_leaves', 'acacia_leaves', 'dark_oak_leaves', 'mangrove_leaves', 'azalea_leaves', 'vine']);
const WATER_TINT   = new Set(['water_still', 'water_flow']);

// Plains biome tint colors
export const TINTS = {
  grass:   [121/255, 192/255, 90/255],
  foliage: [97/255,  153/255, 97/255],
  water:   [63/255,  118/255, 228/255],
  spruce:  [97/255,  153/255, 97/255],
  birch:   [128/255, 167/255, 85/255],
};

export function getTextureTint(texName) {
  if (GRASS_TINT.has(texName))   return TINTS.grass;
  if (FOLIAGE_TINT.has(texName)) return TINTS.foliage;
  if (WATER_TINT.has(texName))   return TINTS.water;
  if (texName === 'spruce_leaves') return TINTS.spruce;
  if (texName === 'birch_leaves')  return TINTS.birch;
  return null;
}

// Fallback color from block name hash for when no texture is available
export function blockNameToColor(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  const r = ((h >> 16) & 0xFF);
  const g = ((h >>  8) & 0xFF);
  const b = (h         & 0xFF);
  // Clamp to reasonable range (not too dark)
  return `rgb(${80 + (r % 120)},${80 + (g % 120)},${80 + (b % 120)})`;
}
