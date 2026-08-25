// Parses classic .schematic files (WorldEdit / MCEdit format)
// Returns { width, height, length, palette, blocks }

// Legacy numeric block ID → minecraft: name (covers the most common blocks)
const LEGACY_NAMES = {
  0: 'minecraft:air',
  1: 'minecraft:stone',
  2: 'minecraft:grass_block',
  3: 'minecraft:dirt',
  4: 'minecraft:cobblestone',
  5: 'minecraft:oak_planks',
  6: 'minecraft:oak_sapling',
  7: 'minecraft:bedrock',
  8: 'minecraft:water',
  9: 'minecraft:water',
  10: 'minecraft:lava',
  11: 'minecraft:lava',
  12: 'minecraft:sand',
  13: 'minecraft:gravel',
  14: 'minecraft:gold_ore',
  15: 'minecraft:iron_ore',
  16: 'minecraft:coal_ore',
  17: 'minecraft:oak_log',
  18: 'minecraft:oak_leaves',
  19: 'minecraft:sponge',
  20: 'minecraft:glass',
  21: 'minecraft:lapis_ore',
  22: 'minecraft:lapis_block',
  23: 'minecraft:dispenser',
  24: 'minecraft:sandstone',
  25: 'minecraft:note_block',
  26: 'minecraft:white_bed',
  27: 'minecraft:powered_rail',
  28: 'minecraft:detector_rail',
  29: 'minecraft:sticky_piston',
  30: 'minecraft:cobweb',
  31: 'minecraft:grass',
  32: 'minecraft:dead_bush',
  33: 'minecraft:piston',
  35: 'minecraft:white_wool',
  37: 'minecraft:dandelion',
  38: 'minecraft:poppy',
  39: 'minecraft:brown_mushroom',
  40: 'minecraft:red_mushroom',
  41: 'minecraft:gold_block',
  42: 'minecraft:iron_block',
  43: 'minecraft:smooth_stone_slab',
  44: 'minecraft:stone_slab',
  45: 'minecraft:bricks',
  46: 'minecraft:tnt',
  47: 'minecraft:bookshelf',
  48: 'minecraft:mossy_cobblestone',
  49: 'minecraft:obsidian',
  50: 'minecraft:torch',
  52: 'minecraft:spawner',
  53: 'minecraft:oak_stairs',
  54: 'minecraft:chest',
  55: 'minecraft:redstone_wire',
  56: 'minecraft:diamond_ore',
  57: 'minecraft:diamond_block',
  58: 'minecraft:crafting_table',
  59: 'minecraft:wheat',
  60: 'minecraft:farmland',
  61: 'minecraft:furnace',
  62: 'minecraft:furnace',
  63: 'minecraft:oak_sign',
  64: 'minecraft:oak_door',
  65: 'minecraft:ladder',
  66: 'minecraft:rail',
  67: 'minecraft:cobblestone_stairs',
  68: 'minecraft:oak_wall_sign',
  69: 'minecraft:lever',
  70: 'minecraft:stone_pressure_plate',
  71: 'minecraft:iron_door',
  72: 'minecraft:oak_pressure_plate',
  73: 'minecraft:redstone_ore',
  74: 'minecraft:redstone_ore',
  75: 'minecraft:redstone_torch',
  76: 'minecraft:redstone_torch',
  77: 'minecraft:stone_button',
  78: 'minecraft:snow',
  79: 'minecraft:ice',
  80: 'minecraft:snow_block',
  81: 'minecraft:cactus',
  82: 'minecraft:clay',
  83: 'minecraft:sugar_cane',
  84: 'minecraft:jukebox',
  85: 'minecraft:oak_fence',
  86: 'minecraft:carved_pumpkin',
  87: 'minecraft:netherrack',
  88: 'minecraft:soul_sand',
  89: 'minecraft:glowstone',
  90: 'minecraft:nether_portal',
  91: 'minecraft:jack_o_lantern',
  92: 'minecraft:cake',
  93: 'minecraft:repeater',
  94: 'minecraft:repeater',
  95: 'minecraft:white_stained_glass',
  96: 'minecraft:oak_trapdoor',
  97: 'minecraft:infested_stone',
  98: 'minecraft:stone_bricks',
  99: 'minecraft:brown_mushroom_block',
  100: 'minecraft:red_mushroom_block',
  101: 'minecraft:iron_bars',
  102: 'minecraft:glass_pane',
  103: 'minecraft:melon',
  104: 'minecraft:pumpkin_stem',
  105: 'minecraft:melon_stem',
  106: 'minecraft:vine',
  107: 'minecraft:oak_fence_gate',
  108: 'minecraft:brick_stairs',
  109: 'minecraft:stone_brick_stairs',
  110: 'minecraft:mycelium',
  111: 'minecraft:lily_pad',
  112: 'minecraft:nether_bricks',
  113: 'minecraft:nether_brick_fence',
  114: 'minecraft:nether_brick_stairs',
  115: 'minecraft:nether_wart',
  116: 'minecraft:enchanting_table',
  117: 'minecraft:brewing_stand',
  118: 'minecraft:cauldron',
  119: 'minecraft:end_portal',
  120: 'minecraft:end_portal_frame',
  121: 'minecraft:end_stone',
  122: 'minecraft:dragon_egg',
  123: 'minecraft:redstone_lamp',
  124: 'minecraft:redstone_lamp',
  125: 'minecraft:oak_planks',
  126: 'minecraft:oak_slab',
  127: 'minecraft:cocoa',
  128: 'minecraft:sandstone_stairs',
  129: 'minecraft:emerald_ore',
  130: 'minecraft:ender_chest',
  131: 'minecraft:tripwire_hook',
  132: 'minecraft:tripwire',
  133: 'minecraft:emerald_block',
  134: 'minecraft:spruce_stairs',
  135: 'minecraft:birch_stairs',
  136: 'minecraft:jungle_stairs',
  137: 'minecraft:command_block',
  138: 'minecraft:beacon',
  139: 'minecraft:cobblestone_wall',
  140: 'minecraft:flower_pot',
  141: 'minecraft:carrots',
  142: 'minecraft:potatoes',
  143: 'minecraft:oak_button',
  145: 'minecraft:anvil',
  146: 'minecraft:trapped_chest',
  147: 'minecraft:light_weighted_pressure_plate',
  148: 'minecraft:heavy_weighted_pressure_plate',
  149: 'minecraft:comparator',
  150: 'minecraft:comparator',
  151: 'minecraft:daylight_detector',
  152: 'minecraft:redstone_block',
  153: 'minecraft:nether_quartz_ore',
  154: 'minecraft:hopper',
  155: 'minecraft:quartz_block',
  156: 'minecraft:quartz_stairs',
  157: 'minecraft:activator_rail',
  158: 'minecraft:dropper',
  159: 'minecraft:white_terracotta',
  160: 'minecraft:white_stained_glass_pane',
  161: 'minecraft:acacia_leaves',
  162: 'minecraft:acacia_log',
  163: 'minecraft:acacia_stairs',
  164: 'minecraft:dark_oak_stairs',
  165: 'minecraft:slime_block',
  166: 'minecraft:barrier',
  167: 'minecraft:iron_trapdoor',
  168: 'minecraft:prismarine',
  169: 'minecraft:sea_lantern',
  170: 'minecraft:hay_block',
  171: 'minecraft:white_carpet',
  172: 'minecraft:terracotta',
  173: 'minecraft:coal_block',
  174: 'minecraft:packed_ice',
  175: 'minecraft:sunflower',
  176: 'minecraft:white_banner',
  177: 'minecraft:white_wall_banner',
  178: 'minecraft:daylight_detector',
  179: 'minecraft:red_sandstone',
  180: 'minecraft:red_sandstone_stairs',
  181: 'minecraft:red_sandstone_slab',
  182: 'minecraft:red_sandstone_slab',
  183: 'minecraft:spruce_fence_gate',
  184: 'minecraft:birch_fence_gate',
  185: 'minecraft:jungle_fence_gate',
  186: 'minecraft:dark_oak_fence_gate',
  187: 'minecraft:acacia_fence_gate',
  188: 'minecraft:spruce_fence',
  189: 'minecraft:birch_fence',
  190: 'minecraft:jungle_fence',
  191: 'minecraft:dark_oak_fence',
  192: 'minecraft:acacia_fence',
  193: 'minecraft:spruce_door',
  194: 'minecraft:birch_door',
  195: 'minecraft:jungle_door',
  196: 'minecraft:acacia_door',
  197: 'minecraft:dark_oak_door',
  198: 'minecraft:end_rod',
  199: 'minecraft:chorus_plant',
  200: 'minecraft:chorus_flower',
  201: 'minecraft:purpur_block',
  202: 'minecraft:purpur_pillar',
  203: 'minecraft:purpur_stairs',
  204: 'minecraft:purpur_slab',
  205: 'minecraft:purpur_slab',
  206: 'minecraft:end_stone_bricks',
  207: 'minecraft:beetroots',
  208: 'minecraft:dirt_path',
  209: 'minecraft:end_gateway',
  210: 'minecraft:repeating_command_block',
  211: 'minecraft:chain_command_block',
  212: 'minecraft:frosted_ice',
  213: 'minecraft:magma_block',
  214: 'minecraft:nether_wart_block',
  215: 'minecraft:red_nether_bricks',
  216: 'minecraft:bone_block',
  217: 'minecraft:structure_void',
  218: 'minecraft:observer',
  219: 'minecraft:white_shulker_box',
  235: 'minecraft:black_shulker_box',
  236: 'minecraft:white_concrete',
  237: 'minecraft:orange_concrete',
  238: 'minecraft:magenta_concrete',
  239: 'minecraft:light_blue_concrete',
  240: 'minecraft:yellow_concrete',
  241: 'minecraft:lime_concrete',
  242: 'minecraft:pink_concrete',
  243: 'minecraft:gray_concrete',
  244: 'minecraft:light_gray_concrete',
  245: 'minecraft:cyan_concrete',
  246: 'minecraft:purple_concrete',
  247: 'minecraft:blue_concrete',
  248: 'minecraft:brown_concrete',
  249: 'minecraft:green_concrete',
  250: 'minecraft:red_concrete',
  251: 'minecraft:black_concrete',
  252: 'minecraft:white_concrete_powder',
  255: 'minecraft:structure_block',
};

const WOOD_TYPES = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'];
const WOOL_COLORS = ['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black'];
const MAX_BLOCKS = 64 * 1024 * 1024;

function legacyIdToName(id, data) {
  // Special data-dependent mappings
  if (id === 5)  return `minecraft:${WOOD_TYPES[data & 7] || 'oak'}_planks`;
  if (id === 6)  return `minecraft:${WOOD_TYPES[data & 7] || 'oak'}_sapling`;
  if (id === 12) return data === 1 ? 'minecraft:red_sand' : 'minecraft:sand';
  if (id === 17) return `minecraft:${['oak','spruce','birch','jungle'][(data & 3)] || 'oak'}_log`;
  if (id === 18) return `minecraft:${['oak','spruce','birch','jungle'][(data & 3)] || 'oak'}_leaves`;
  if (id === 35) return `minecraft:${WOOL_COLORS[data & 15] || 'white'}_wool`;
  if (id === 95) return `minecraft:${WOOL_COLORS[data & 15] || 'white'}_stained_glass`;
  if (id === 159) return `minecraft:${WOOL_COLORS[data & 15] || 'white'}_terracotta`;
  if (id === 160) return `minecraft:${WOOL_COLORS[data & 15] || 'white'}_stained_glass_pane`;
  if (id === 162) return `minecraft:${['acacia','dark_oak'][(data & 1)] || 'acacia'}_log`;
  if (id === 171) return `minecraft:${WOOL_COLORS[data & 15] || 'white'}_carpet`;
  if (id === 236) return `minecraft:${WOOL_COLORS[data & 15] || 'white'}_concrete`;
  if (id === 252) return `minecraft:${WOOL_COLORS[data & 15] || 'white'}_concrete_powder`;
  return LEGACY_NAMES[id] || 'minecraft:stone';
}

export function parseSchematic(nbt) {
  const root = nbt.value;
  const width  = root['Width'];
  const height = root['Height'];
  const length = root['Length'];
  const blockIds   = root['Blocks'];   // Int8Array (byte array)
  const blockData  = root['Data'];     // Int8Array (byte array)

  if (!blockIds) throw new Error('No Blocks tag in schematic');
  if (![width, height, length].every(value => Number.isInteger(value) && value > 0)) {
    throw new Error('Invalid schematic dimensions');
  }

  const palette = ['minecraft:air'];
  const nameToIdx = new Map([['minecraft:air', 0]]);
  const total = width * height * length;
  if (total > MAX_BLOCKS) throw new Error('Schematic is too large to load');
  if (blockIds.length < total) throw new Error('Schematic Blocks tag is truncated');
  if (blockData && blockData.length < total) throw new Error('Schematic Data tag is truncated');
  const blocks = new Uint32Array(total);

  for (let i = 0; i < total; i++) {
    const id  = blockIds[i] & 0xFF;
    const dat = blockData ? (blockData[i] & 0x0F) : 0;
    if (id === 0) continue; // air

    const name = legacyIdToName(id, dat);
    if (!nameToIdx.has(name)) { nameToIdx.set(name, palette.length); palette.push(name); }

    // .schematic index order: (y * length + z) * width + x
    // We want: x + z * width + y * width * length
    // Extract x,y,z from schematic index then re-encode
    const schIdx = i; // same iteration order as stored
    // i = y*length*width + z*width + x  → rearrange:
    const y = Math.floor(schIdx / (length * width));
    const rem = schIdx % (length * width);
    const z = Math.floor(rem / width);
    const x = rem % width;
    const myIdx = x + z * width + y * width * length;
    blocks[myIdx] = nameToIdx.get(name);
  }

  return { width, height, length, palette, blocks };
}
