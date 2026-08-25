function normalizeId(value, fallbackNamespace = 'minecraft') {
  if (!value) return null;
  return value.includes(':') ? value : `${fallbackNamespace}:${value}`;
}

export function blockStateProperties(blockName) {
  const match = blockName.match(/\[([^\]]*)\]/);
  if (!match) return {};
  return Object.fromEntries(match[1].split(',').map(pair => {
    const separator = pair.indexOf('=');
    return separator === -1 ? [pair, ''] : [pair.slice(0, separator), pair.slice(separator + 1)];
  }));
}

function variantMatches(key, properties) {
  if (!key) return true;
  return key.split(',').every(condition => {
    const separator = condition.indexOf('=');
    if (separator === -1) return false;
    const name = condition.slice(0, separator);
    const expected = condition.slice(separator + 1).split('|');
    return expected.includes(properties[name]);
  });
}

function conditionMatches(name, expectedValue, properties) {
  const expected = String(expectedValue).split('|');
  return expected.includes(properties[name]);
}

function multipartMatches(when, properties) {
  if (!when) return true;
  if (Array.isArray(when.OR)) return when.OR.some(part => multipartMatches(part, properties));
  if (Array.isArray(when.AND)) return when.AND.every(part => multipartMatches(part, properties));
  return Object.entries(when).every(([name, expectedValue]) => conditionMatches(name, expectedValue, properties));
}

export function selectBlockState(blockName, blockstates) {
  const blockId = normalizeId(blockName.split('[')[0]);
  const state = blockstates.get(blockId);
  if (!state) return null;
  const properties = blockStateProperties(blockName);

  if (state.variants) {
    const candidates = Object.entries(state.variants)
      .filter(([key]) => variantMatches(key, properties))
      .sort(([left], [right]) => (right ? right.split(',').length : 0) - (left ? left.split(',').length : 0));
    if (!candidates.length) return null;
    const value = candidates[0][1];
    return (Array.isArray(value) ? value : [value]).filter(Boolean);
  }

  if (state.multipart) {
    const choices = [];
    for (const part of state.multipart) {
      if (!multipartMatches(part.when, properties)) continue;
      const apply = Array.isArray(part.apply) ? part.apply : [part.apply];
      choices.push(...apply.filter(Boolean));
    }
    return choices.length ? choices : null;
  }
  return null;
}

function mergeModel(parent, child) {
  return {
    textures: { ...(parent?.textures ?? {}), ...(child?.textures ?? {}) },
    elements: child.elements ?? parent?.elements ?? [],
    ambientocclusion: child.ambientocclusion ?? parent?.ambientocclusion,
  };
}

const CUBE_ELEMENTS = [{
  from: [0, 0, 0], to: [16, 16, 16],
  faces: {
    down: { texture: '#down' }, up: { texture: '#up' },
    north: { texture: '#north' }, south: { texture: '#south' },
    west: { texture: '#west' }, east: { texture: '#east' },
  },
}];

function vanillaParentModel(modelId) {
  const parent = modelId.split(':')[1]?.replace(/^block\//, '');
  if (parent === 'cube_all') {
    return { elements: CUBE_ELEMENTS, textures: { down: '#all', up: '#all', north: '#all', south: '#all', west: '#all', east: '#all' } };
  }
  if (parent === 'cube_bottom_top') {
    return { elements: CUBE_ELEMENTS, textures: { down: '#bottom', up: '#top', north: '#side', south: '#side', west: '#side', east: '#side' } };
  }
  if (parent === 'cube_column') {
    return { elements: CUBE_ELEMENTS, textures: { down: '#end', up: '#end', north: '#side', south: '#side', west: '#side', east: '#side' } };
  }
  if (parent === 'cube_column_horizontal') {
    return { elements: CUBE_ELEMENTS, textures: { down: '#side', up: '#side', north: '#end', south: '#end', west: '#side', east: '#side' } };
  }
  return null;
}

export function resolveTextureReference(reference, textures) {
  let value = reference;
  const seen = new Set();
  while (typeof value === 'string' && value.startsWith('#')) {
    const key = value.slice(1);
    if (seen.has(key)) return null;
    seen.add(key);
    value = textures[key];
  }
  return typeof value === 'string' ? value : null;
}

export function resolveModel(modelName, models, seen = new Set()) {
  const modelId = normalizeId(modelName);
  if (!modelId || seen.has(modelId)) return null;
  const model = models.get(modelId) ?? vanillaParentModel(modelId);
  if (!model) return null;
  seen.add(modelId);

  let parent = null;
  if (model.parent) parent = resolveModel(model.parent, models, seen);
  const resolved = mergeModel(parent, model);
  resolved.textures = Object.fromEntries(Object.entries(resolved.textures).map(([key, value]) => [
    key,
    resolveTextureReference(value, resolved.textures) ?? value,
  ]));
  return resolved;
}

export function resolveBlockModels(blockName, blockstates, models) {
  const choices = selectBlockState(blockName, blockstates);
  if (!choices?.length) return [];

  return choices.map(choice => {
    const model = resolveModel(choice.model, models);
    if (!model) return null;
    const elements = (model.elements ?? []).map(element => ({
      ...element,
      faces: Object.fromEntries(Object.entries(element.faces ?? {}).map(([faceName, face]) => [
        faceName,
        { ...face, texture: resolveTextureReference(face.texture, model.textures) ?? face.texture },
      ])),
    }));
    return {
      ...model,
      elements,
      rotation: { x: choice.x ?? 0, y: choice.y ?? 0 },
      uvlock: Boolean(choice.uvlock),
    };
  }).filter(Boolean);
}

export function resolveBlockModel(blockName, blockstates, models) {
  return resolveBlockModels(blockName, blockstates, models)[0] ?? null;
}

export function parseResourcePackJson(files) {
  const blockstates = new Map();
  const models = new Map();
  const decoder = new TextDecoder();

  for (const [path, data] of Object.entries(files)) {
    const match = path.match(/^assets\/([^/]+)\/(blockstates|models)\/(.+)\.json$/);
    if (!match) continue;
    try {
      const parsed = JSON.parse(decoder.decode(data));
      const key = `${match[1]}:${match[3]}`;
      (match[2] === 'blockstates' ? blockstates : models).set(key, parsed);
    } catch {
      // Ignore unrelated or malformed JSON entries in a user-supplied pack.
    }
  }
  return { blockstates, models };
}
