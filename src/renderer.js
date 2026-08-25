import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { isOpaque, getBlockFaceTextures } from './block-registry.js';
import { getBlockBoxes, boxToFaces } from './block-shapes.js';
import { sourceBlockIndexForFace } from './hover.js';

// Face definitions: [dx,dy,dz], vertex offsets, uv, AO brightness
// Vertices in CCW order from outside the face
const FACES = [
  { // Top (+Y), normal (0,1,0)
    dir: [0,1,0], name: 'top', brightness: 1.0,
    verts: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]],
    uvs:  [[0,1],[1,1],[1,0],[0,0]],
  },
  { // Bottom (-Y), normal (0,-1,0)
    dir: [0,-1,0], name: 'bottom', brightness: 0.5,
    verts: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]],
    uvs:  [[0,0],[1,0],[1,1],[0,1]],
  },
  { // North (-Z)
    dir: [0,0,-1], name: 'north', brightness: 0.8,
    verts: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]],
    uvs:  [[0,1],[1,1],[1,0],[0,0]],
  },
  { // South (+Z)
    dir: [0,0,1], name: 'south', brightness: 0.8,
    verts: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
    uvs:  [[0,1],[1,1],[1,0],[0,0]],
  },
  { // East (+X)
    dir: [1,0,0], name: 'east', brightness: 0.9,
    verts: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]],
    uvs:  [[0,1],[1,1],[1,0],[0,0]],
  },
  { // West (-X)
    dir: [-1,0,0], name: 'west', brightness: 0.9,
    verts: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]],
    uvs:  [[0,1],[1,1],[1,0],[0,0]],
  },
];

// Indices for a quad (2 triangles, CCW)
const QUAD_INDICES = [0,1,2, 0,2,3];
const MODEL_FACES = {
  up: FACES[0], down: FACES[1], north: FACES[2], south: FACES[3], east: FACES[4], west: FACES[5],
};

function rotateModelPoint(point, origin, axis, angle) {
  const radians = angle * Math.PI / 180;
  const sin = Math.sin(radians), cos = Math.cos(radians);
  const x = point[0] - origin[0], y = point[1] - origin[1], z = point[2] - origin[2];
  if (axis === 'x') return [x + origin[0], y * cos - z * sin + origin[1], y * sin + z * cos + origin[2]];
  if (axis === 'y') return [x * cos + z * sin + origin[0], y + origin[1], -x * sin + z * cos + origin[2]];
  return [x * cos - y * sin + origin[0], x * sin + y * cos + origin[1], z + origin[2]];
}

function modelPoint(point, elementRotation, variantRotation) {
  let result = point;
  if (elementRotation) {
    result = rotateModelPoint(result, elementRotation.origin ?? [8, 8, 8], elementRotation.axis, elementRotation.angle ?? 0);
  }
  result = rotateModelPoint(result, [8, 8, 8], 'y', variantRotation.y ?? 0);
  result = rotateModelPoint(result, [8, 8, 8], 'x', variantRotation.x ?? 0);
  return result.map(value => value / 16);
}

function modelNormal(normal, elementRotation, variantRotation) {
  const origin = modelPoint([8, 8, 8], elementRotation, variantRotation);
  const endpoint = modelPoint([
    8 + normal[0], 8 + normal[1], 8 + normal[2],
  ], elementRotation, variantRotation);
  const length = Math.hypot(endpoint[0] - origin[0], endpoint[1] - origin[1], endpoint[2] - origin[2]) || 1;
  return endpoint.map((value, index) => (value - origin[index]) / length);
}

function modelDirection(direction, variantRotation) {
  return modelNormal(direction, null, variantRotation).map(value => Math.round(value));
}

function modelFaceUvs(face) {
  const [u0, v0, u1, v1] = face.uv ?? [0, 0, 16, 16];
  let uvs = [[u0 / 16, 1 - v1 / 16], [u1 / 16, 1 - v1 / 16], [u1 / 16, 1 - v0 / 16], [u0 / 16, 1 - v0 / 16]];
  const turns = ((((face.rotation ?? 0) % 360) + 360) % 360) / 90;
  for (let i = 0; i < turns; i++) {
    uvs = [uvs[3], uvs[0], uvs[1], uvs[2]];
  }
  return uvs;
}

function blockIdx(x, y, z, w, l) { return x + z * w + y * w * l; }

function getBlock(blocks, palette, x, y, z, w, h, l) {
  if (x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= l) return 'minecraft:air';
  return palette[blocks[blockIdx(x, y, z, w, l)]];
}

export class SchematicRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this._meshes = [];
    this._blockEntityObjects = [];
    this._grid = null;
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._pointerPosition = null;
    this._hoverFrame = 0;
    this._isDragging = false;
    this._initScene();
    this._initHover();
    this._animate();
  }

  _initScene() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    } catch (error) {
      throw new Error('WebGL could not be initialized. Try a browser with hardware acceleration enabled.');
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x1a1a1f);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1a1a1f, 0.002);

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
    this.camera.position.set(50, 50, 80);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.maxDistance = 1500;
    this.controls.addEventListener('start', () => {
      this._isDragging = true;
      this._hideBlockTooltip();
    });
    this.controls.addEventListener('end', () => { this._isDragging = false; });

    // Ambient + directional lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.5);
    sun.position.set(1, 2, 1);
    this.scene.add(sun);

    window.addEventListener('resize', () => this._onResize());
  }

  _initHover() {
    this.tooltip = document.getElementById('block-tooltip');
    if (!this.tooltip) return;
    this.canvas.addEventListener('pointermove', event => {
      this._pointerPosition = { clientX: event.clientX, clientY: event.clientY };
      if (!this._hoverFrame) this._hoverFrame = requestAnimationFrame(() => {
        this._hoverFrame = 0;
        this._updateBlockTooltip();
      });
    });
    this.canvas.addEventListener('pointerleave', () => {
      this._pointerPosition = null;
      this._hideBlockTooltip();
    });
  }

  _hideBlockTooltip() {
    if (this.tooltip) this.tooltip.hidden = true;
  }

  _updateBlockTooltip() {
    if (!this.tooltip || !this._pointerPosition || this._isDragging || !this._meshes.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = this._pointerPosition.clientX - rect.left;
    const y = this._pointerPosition.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      this._hideBlockTooltip();
      return;
    }

    this._pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hit = this._raycaster.intersectObjects(this._meshes, false)[0];
    if (!hit) {
      this._hideBlockTooltip();
      return;
    }

    const sourceIndex = sourceBlockIndexForFace(hit.object.userData.sourceIndices, hit.faceIndex);
    const data = hit.object.userData.schematicData;
    const blockName = data && sourceIndex !== undefined ? data.palette[data.blocks[sourceIndex]] : null;
    if (!blockName || blockName === 'minecraft:air') {
      this._hideBlockTooltip();
      return;
    }

    this.tooltip.textContent = blockName;
    this.tooltip.hidden = false;
    const parentRect = this.tooltip.parentElement.getBoundingClientRect();
    const tooltipWidth = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;
    const left = Math.max(0, Math.min(x + 14, parentRect.width - tooltipWidth));
    const top = Math.max(0, Math.min(y + 14, parentRect.height - tooltipHeight));
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  _onResize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setWireframe(on) {
    for (const m of this._meshes) {
      if (Array.isArray(m.material)) m.material.forEach(mt => { mt.wireframe = on; });
      else m.material.wireframe = on;
    }
  }

  setGrid(on, cx, cz, sz) {
    if (this._grid) { this.scene.remove(this._grid); this._grid.geometry.dispose(); this._grid = null; }
    if (!on) return;
    const size = Math.max(sz * 2, 64);
    const grid = new THREE.GridHelper(size, Math.floor(size), 0x444455, 0x333344);
    grid.position.set(cx, -0.01, cz);
    this._grid = grid;
    this.scene.add(grid);
  }

  resetCamera(cx, cy, cz, size) {
    const dist = size * 1.5;
    this.camera.position.set(cx + dist * 0.6, cy + dist * 0.5, cz + dist * 0.8);
    this.controls.target.set(cx, cy, cz);
    this.controls.update();
  }

  clearMeshes() {
    this._hideBlockTooltip();
    for (const m of this._meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach(mt => mt.dispose());
      else m.material.dispose();
    }
    this._meshes = [];
    for (const object of this._blockEntityObjects) {
      this.scene.remove(object);
      object.material.map?.dispose();
      object.material.dispose();
    }
    this._blockEntityObjects = [];
  }

  _addSignLabels(blockEntities = []) {
    for (const entity of blockEntities) {
      if (!String(entity.id).toLowerCase().includes('sign')) continue;
      const data = entity.data ?? {};
      const lines = [1, 2, 3, 4].map(index => data[`Text${index}`] ?? data[`text${index}`] ?? '')
        .map(value => {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            return typeof parsed === 'object' ? parsed.text ?? '' : String(parsed ?? '');
          } catch {
            return String(value);
          }
        });
      if (!lines.some(Boolean)) continue;

      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 128;
      const context = labelCanvas.getContext('2d');
      context.font = '22px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#fff8dc';
      context.strokeStyle = '#2b2118';
      context.lineWidth = 5;
      lines.forEach((line, index) => {
        const y = 18 + index * 30;
        context.strokeText(line, 128, y);
        context.fillText(line, 128, y);
      });

      const texture = new THREE.CanvasTexture(labelCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(entity.x + 0.5, entity.y + 1.2, entity.z + 0.5);
      sprite.scale.set(1.6, 0.8, 1);
      this.scene.add(sprite);
      this._blockEntityObjects.push(sprite);
    }
  }

  /**
   * Build and add geometry for the schematic.
   * @param {object} data  - { width, height, length, palette, blocks }
   * @param {object} texMgr - TextureManager instance
   * @param {object} opts  - { cull, yMin, yMax }
   * @param {function} onProgress - (pct) callback
   */
  async buildGeometry(data, texMgr, opts = {}, onProgress) {
    this.clearMeshes();
    const { width, height, length, palette, blocks } = data;
    const { cull = true, yMin = 0, yMax = height } = opts;

    // Group visible faces by their texture name
    // Each group: { texName, blockName, positions[], normals[], uvs[], indices[] }
    const groups = new Map(); // texName → group
    const blockCache = new Map();

    const getBlockRenderData = blockName => {
      if (!blockCache.has(blockName)) {
        const resourceModels = texMgr.getBlockModels?.(blockName) ?? [texMgr.getBlockModel?.(blockName)].filter(Boolean);
        blockCache.set(blockName, {
          opaque: isOpaque(blockName),
          faceTextures: getBlockFaceTextures(blockName),
          resourceModels,
          boxes: resourceModels.some(model => model?.elements?.length) ? null : getBlockBoxes(blockName),
        });
      }
      return blockCache.get(blockName);
    };

    const ensureGroup = (texName, blockName) => {
      if (!groups.has(texName)) {
        groups.set(texName, {
          texName, blockName,
          positions: [], normals: [], uvs: [], colors: [], indices: [], sourceIndices: [],
          vertexCount: 0,
        });
      }
      return groups.get(texName);
    };

    const sliceY = Math.min(yMax, height);
    const startY = Math.max(yMin, 0);
    const total = width * sliceY * length;
    let processed = 0;
    let lastProgress = 0;

    const CHUNK = 50000; // blocks per frame yield

    // Helper: push one quad into the correct texture group
    const addQuad = (texName, bName, bx, by, bz, quad, sourceIndex) => {
      const group = ensureGroup(texName, bName);
      const base = group.vertexCount;
      const [nx, ny, nz] = quad.normal;
      const br = quad.brightness;
      for (let vi = 0; vi < 4; vi++) {
        const [vx, vy, vz] = quad.verts[vi];
        group.positions.push(bx + vx, by + vy, bz + vz);
        group.normals.push(nx, ny, nz);
        group.uvs.push(quad.uvs[vi][0], quad.uvs[vi][1]);
        group.colors.push(br, br, br);
      }
      for (const qi of QUAD_INDICES) group.indices.push(base + qi);
      group.sourceIndices.push(sourceIndex);
      group.vertexCount += 4;
    };

    const addModel = (model, bName, bx, by, bz, sourceIndex) => {
      for (const element of model.elements ?? []) {
        const [x0, y0, z0] = element.from ?? [0, 0, 0];
        const [x1, y1, z1] = element.to ?? [16, 16, 16];
        for (const [faceName, face] of Object.entries(element.faces ?? {})) {
          const template = MODEL_FACES[faceName];
          if (!template || !face.texture) continue;
          if (cull && face.cullface) {
            const cullTemplate = MODEL_FACES[face.cullface];
            if (!cullTemplate) continue;
            const [dx, dy, dz] = modelDirection(cullTemplate.dir, model.rotation);
            const nb = getBlock(blocks, palette, bx + dx, by + dy, bz + dz, width, height, length);
            if (isOpaque(nb)) continue;
          }
          const verts = template.verts.map(([vx, vy, vz]) => modelPoint([
            vx ? x1 : x0,
            vy ? y1 : y0,
            vz ? z1 : z0,
          ], element.rotation, model.rotation));
          const texture = face.texture.replace(/^#/, '');
          const group = ensureGroup(texture, bName);
          const base = group.vertexCount;
          for (let vi = 0; vi < 4; vi++) {
            const [vx, vy, vz] = verts[vi];
            group.positions.push(bx + vx, by + vy, bz + vz);
            group.normals.push(...modelNormal(template.dir, element.rotation, model.rotation));
            group.uvs.push(...modelFaceUvs(face)[vi]);
            group.colors.push(template.brightness, template.brightness, template.brightness);
          }
          for (const qi of QUAD_INDICES) group.indices.push(base + qi);
          group.sourceIndices.push(sourceIndex);
          group.vertexCount += 4;
        }
      }
    };

    for (let y = startY; y < sliceY; y++) {
      for (let z = 0; z < length; z++) {
        for (let x = 0; x < width; x++) {
          processed++;
          const bName = palette[blocks[blockIdx(x, y, z, width, length)]];
          if (!bName || bName === 'minecraft:air') continue;
          const renderData = getBlockRenderData(bName);
          if (!renderData.opaque && bName.includes('air')) continue;

          const { faceTextures, resourceModels } = renderData;
          if (resourceModels.some(model => model?.elements?.length)) {
            for (const resourceModel of resourceModels) {
              if (resourceModel?.elements?.length) addModel(resourceModel, bName, x, y, z, blockIdx(x, y, z, width, length));
            }
            continue;
          }
          const { boxes } = renderData;

          if (boxes) {
            // ── Non-cube block (slab, stair, carpet…) ──────────────
            for (const box of boxes) {
              for (const quad of boxToFaces(box)) {
                if (cull && quad.atBoundary) {
                  const [dx, dy, dz] = quad.normal;
                  const nb = getBlock(blocks, palette, x+dx, y+dy, z+dz, width, height, length);
                  if (isOpaque(nb)) continue;
                }
                const texName = faceTextures[quad.faceName] ?? faceTextures.top;
                addQuad(texName, bName, x, y, z, quad, blockIdx(x, y, z, width, length));
              }
            }
          } else {
            // ── Full cube ──────────────────────────────────────────
            const faceNames = ['top','bottom','north','south','east','west'];
            for (let fi = 0; fi < FACES.length; fi++) {
              const face = FACES[fi];
              const [dx, dy, dz] = face.dir;

              if (cull) {
                const nb = getBlock(blocks, palette, x+dx, y+dy, z+dz, width, height, length);
                if (isOpaque(nb)) continue;
              }

              const texName = faceTextures[faceNames[fi]] ?? faceTextures.top;
              // Inline FACES quad to addQuad
              const group = ensureGroup(texName, bName);
              const base = group.vertexCount;
              const br = face.brightness;
              for (let vi = 0; vi < 4; vi++) {
                const [vx, vy, vz] = face.verts[vi];
                group.positions.push(x + vx, y + vy, z + vz);
                group.normals.push(dx, dy, dz);
                group.uvs.push(face.uvs[vi][0], face.uvs[vi][1]);
                group.colors.push(br, br, br);
              }
              for (const qi of QUAD_INDICES) group.indices.push(base + qi);
              group.sourceIndices.push(blockIdx(x, y, z, width, length));
              group.vertexCount += 4;
            }
          }
        }

        // Yield to keep UI responsive
        if (processed % CHUNK < width) {
          const pct = Math.round(processed / total * 100);
          if (pct !== lastProgress) {
            lastProgress = pct;
            if (onProgress) onProgress(pct);
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }
    }

    // Build Three.js meshes from groups
    for (const group of groups.values()) {
      if (group.indices.length === 0) continue;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(group.positions, 3));
      geo.setAttribute('normal',   new THREE.Float32BufferAttribute(group.normals,   3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(group.uvs,       2));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(group.colors,    3));
      geo.setIndex(group.indices);

      const texture = texMgr.resolve(group.texName, group.blockName);
      const mat = new THREE.MeshLambertMaterial({
        map: texture,
        vertexColors: true,
        side: THREE.FrontSide,
      });

      // Transparency for glass, ice, water etc.
      const isTransparent = !isOpaque(group.blockName) || group.blockName.includes('glass') || group.blockName.includes('ice');
      if (isTransparent) {
        mat.transparent = true;
        mat.opacity = group.blockName.includes('water') ? 0.75 : 0.85;
        mat.side = THREE.DoubleSide;
        mat.depthWrite = false;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.sourceIndices = group.sourceIndices;
      mesh.userData.schematicData = data;
      this.scene.add(mesh);
      this._meshes.push(mesh);
    }

    this._addSignLabels(data.blockEntities);

    if (onProgress) onProgress(100);
    return this._meshes.length;
  }
}
