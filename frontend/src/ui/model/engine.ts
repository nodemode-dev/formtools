import {
  AmbientLight, AnimationAction, AnimationMixer, AxesHelper, Box3, Box3Helper, BufferGeometry, CanvasTexture, Color, DirectionalLight,
  GridHelper, Group, Line, LineBasicMaterial, Material, Mesh, MeshBasicMaterial, MeshMatcapMaterial, MeshNormalMaterial,
  NeutralToneMapping, Object3D, PerspectiveCamera, PMREMGenerator, Points, Raycaster, Scene, SphereGeometry, SRGBColorSpace, Texture, Vector2, Vector3,
  WebGLRenderer, WebGLRenderTarget, type SkinnedMesh,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ClipRow, Loaded, MaterialRow, NodeKind, NodeRow, RenderMode, SceneDump, StageHooks, StatsData, TextureRow, ViewName } from './types';

const MAX_NODES = 4000;
const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap', 'envMap', 'specularMap', 'clearcoatMap', 'sheenColorMap', 'transmissionMap', 'thicknessMap', 'matcap', 'gradientMap'];

function textureSize(t: Texture): [number, number] {
  const img = t.image as { width?: number; height?: number; naturalWidth?: number; videoWidth?: number } | undefined;
  if (!img) return [0, 0];
  return [img.naturalWidth || img.videoWidth || img.width || 0, img.height || 0];
}

function disposeMaterial(m: Material, seen: Set<unknown>): void {
  if (seen.has(m)) return;
  seen.add(m);
  for (const v of Object.values(m)) {
    const t = v as Texture | null;
    if (t && (t as Texture).isTexture && !seen.has(t)) { seen.add(t); t.dispose(); }
  }
  m.dispose();
}

export function disposeTree(object: Object3D): void {
  const seen = new Set<unknown>();
  object.traverse((o) => {
    const m = o as Mesh & SkinnedMesh;
    if (m.geometry) m.geometry.dispose();
    if (m.isSkinnedMesh && m.skeleton) m.skeleton.dispose();
    matList(o).forEach((x) => disposeMaterial(x, seen));
  });
}

function kindOf(o: Object3D): NodeKind {
  const x = o as unknown as Record<string, unknown>;
  if (x.isBone) return 'bone';
  if (x.isMesh) return 'mesh';
  if (x.isPoints) return 'points';
  if (x.isLine) return 'line';
  if (x.isLight) return 'light';
  if (x.isCamera) return 'camera';
  if (o.children.length) return 'group';
  return 'other';
}

function trianglesOf(o: Object3D): number {
  const m = o as Mesh;
  if (!m.isMesh) return 0;
  const g = m.geometry as BufferGeometry;
  const idx = g.getIndex();
  const pos = g.getAttribute('position');
  return idx ? Math.floor(idx.count / 3) : pos ? Math.floor(pos.count / 3) : 0;
}

function matList(o: Object3D): Material[] {
  const m = (o as Mesh).material as Material | Material[] | undefined;
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
}

function matcapTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(46, 40, 4, 64, 64, 66);
    grad.addColorStop(0, '#f4f1ec');
    grad.addColorStop(0.45, '#b4aea6');
    grad.addColorStop(0.85, '#4a4743');
    grad.addColorStop(1, '#22201f');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Stage {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(40, 1, 0.01, 1000);
  private readonly controls: OrbitControls;
  private readonly root = new Group();
  private readonly helpers = new Group();
  private readonly overlay = new Group();
  private readonly envTarget: WebGLRenderTarget;
  private readonly probe: HTMLElement;
  private readonly swatch = Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
  private readonly raycaster = new Raycaster();
  private readonly originals = new WeakMap<Mesh, Material | Material[]>();
  private readonly modeMats: Record<'wireframe' | 'normals' | 'matcap', Material>;
  private readonly matcap: CanvasTexture;
  private readonly selection = new Box3Helper(new Box3(), new Color(0xf97316));
  private readonly markers: Mesh[];
  private readonly measureLine: Line;
  private readonly sphereGeo = new SphereGeometry(1, 14, 10);
  private mixer: AnimationMixer | null = null;
  private clips: Loaded['clips'] = [];
  private action: AnimationAction | null = null;
  private clipIndex = 0;
  private speed = 1;
  private playing = false;
  private lastTick = 0;
  private raf = 0;
  private loopRaf = 0;
  private grid: GridHelper | null = null;
  private axes: AxesHelper | null = null;
  private box = new Box3();
  private radius = 1;
  private mode: RenderMode = 'lit';
  private showGrid = true;
  private showAxes = false;
  private zUp = false;
  private measuring = false;
  private points: Vector3[] = [];
  private selectedId: string | null = null;
  private triangles = 0;
  private vertices = 0;
  private meshes = 0;
  private disposed = false;
  private pointer: { x: number; y: number; t: number } | null = null;
  private readonly observer: ResizeObserver;
  private readonly theme: MutationObserver;
  private readonly cleanups: Array<() => void> = [];

  constructor(readonly canvas: HTMLCanvasElement, private readonly host: HTMLElement, private readonly hooks: StageHooks) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.probe = document.createElement('i');
    this.probe.style.display = 'none';
    host.appendChild(this.probe);

    const pm = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envTarget = pm.fromScene(room, 0.04);
    room.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) { m.geometry.dispose(); matList(m).forEach((x) => x.dispose()); }
    });
    pm.dispose();
    this.scene.environment = this.envTarget.texture;

    this.scene.add(this.camera);
    this.scene.add(new AmbientLight(0xffffff, 0.25));
    const head = new DirectionalLight(0xffffff, 1.1);
    head.position.set(0.6, 1, 1.2);
    this.camera.add(head);
    this.camera.add(head.target);
    head.target.position.set(0, 0, -4);

    this.scene.add(this.root, this.helpers, this.overlay);
    this.camera.position.set(2, 1.4, 3);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => this.request());

    this.matcap = matcapTexture();
    this.modeMats = {
      wireframe: new MeshBasicMaterial({ wireframe: true, color: 0xcccccc }),
      normals: new MeshNormalMaterial(),
      matcap: new MeshMatcapMaterial({ matcap: this.matcap }),
    };

    this.selection.visible = false;
    this.selection.renderOrder = 998;
    (this.selection.material as LineBasicMaterial).depthTest = false;
    this.overlay.add(this.selection);

    this.markers = [0, 1].map(() => {
      const m = new Mesh(this.sphereGeo, new MeshBasicMaterial({ color: 0xf97316, depthTest: false }));
      m.renderOrder = 999;
      m.visible = false;
      this.overlay.add(m);
      return m;
    });
    const lg = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
    this.measureLine = new Line(lg, new LineBasicMaterial({ color: 0xf97316, depthTest: false }));
    this.measureLine.renderOrder = 999;
    this.measureLine.frustumCulled = false;
    this.measureLine.visible = false;
    this.overlay.add(this.measureLine);

    canvas.addEventListener('pointerdown', (e) => { this.pointer = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('dblclick', (e) => this.onDouble(e));
    const lost = (e: Event): void => e.preventDefault();
    const restored = (): void => this.request();
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    this.cleanups.push(() => { canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored); });

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.theme = new MutationObserver(() => this.applyTheme());
    this.theme.observe(document.documentElement, { attributes: true });
    this.theme.observe(document.body, { attributes: true });
    this.applyTheme();
    this.resize();
  }

  private token(name: string, fallback: string): Color {
    this.probe.style.color = '';
    this.probe.style.color = `var(${name})`;
    const v = getComputedStyle(this.probe).color;
    const c = new Color(fallback);
    const g = this.swatch.getContext('2d', { willReadFrequently: true });
    if (v && g) {
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = fallback;
      g.fillStyle = v;
      g.fillRect(0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      c.setRGB(d[0] / 255, d[1] / 255, d[2] / 255, SRGBColorSpace);
    }
    return c;
  }

  applyTheme(): void {
    if (this.disposed) return;
    const bg = this.token('--canvas-bg', '#1c1b1d');
    this.renderer.setClearColor(bg, 1);
    const accent = this.token('--accent-color', '#f97316');
    (this.selection.material as LineBasicMaterial).color.copy(accent);
    (this.measureLine.material as LineBasicMaterial).color.copy(accent);
    this.markers.forEach((m) => (m.material as MeshBasicMaterial).color.copy(accent));
    (this.modeMats.wireframe as MeshBasicMaterial).color.copy(this.token('--text-secondary', '#a4a4a4'));
    this.paintGrid();
    this.request();
  }

  private paintGrid(): void {
    const g = this.grid;
    if (!g) return;
    const center = this.token('--line-3', '#555555');
    const line = this.token('--line-2', '#34333a');
    const attr = g.geometry.getAttribute('color');
    const divisions = (g.userData.divisions as number) ?? 10;
    let i = 0;
    for (let k = 0; k <= divisions; k++) {
      const c = k === divisions / 2 ? center : line;
      for (let j = 0; j < 4; j++) attr.setXYZ(i++, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
  }

  resize(): void {
    if (this.disposed) return;
    const w = Math.floor(this.host.clientWidth);
    const h = Math.floor(this.host.clientHeight);
    if (w < 2 || h < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.renderer.getPixelRatio() !== dpr) this.renderer.setPixelRatio(dpr);
    const size = this.renderer.getSize(new Vector2());
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.request();
  }

  request(): void {
    if (this.disposed || this.raf || this.loopRaf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
    this.hooks.stats(this.stats());
  }

  show(loaded: Loaded, zUp: boolean): void {
    this.clear();
    this.zUp = zUp;
    this.root.rotation.x = zUp ? -Math.PI / 2 : 0;
    this.root.add(loaded.object);
    this.clips = loaded.clips;
    this.clipIndex = 0;
    this.countGeometry();
    this.setMode(this.mode);
    if (loaded.clips.length) {
      this.mixer = new AnimationMixer(loaded.object);
      this.bindClip(0);
    }
    this.fit(true);
  }

  private countGeometry(): void {
    let t = 0, v = 0, m = 0;
    this.root.traverseVisible((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        m++;
        t += trianglesOf(mesh);
        v += mesh.geometry.getAttribute('position')?.count ?? 0;
      } else if ((o as Points).isPoints) {
        v += (o as Points).geometry.getAttribute('position')?.count ?? 0;
      }
    });
    this.triangles = t;
    this.vertices = v;
    this.meshes = m;
  }

  stats(): StatsData {
    const info = this.renderer.info;
    return { triangles: this.triangles, vertices: this.vertices, meshes: this.meshes, calls: info.render.calls, textures: info.memory.textures, geometries: info.memory.geometries };
  }

  clear(): void {
    this.pause();
    this.setMeasuring(false);
    this.select(null);
    this.restoreMaterials();
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.mixer.getRoot()); }
    this.mixer = null;
    this.action = null;
    this.clips = [];
    for (const child of [...this.root.children]) {
      disposeTree(child);
      this.root.remove(child);
    }
    this.disposeHelpers();
    this.triangles = this.vertices = this.meshes = 0;
    this.request();
  }

  private disposeHelpers(): void {
    for (const h of [this.grid, this.axes]) {
      if (!h) continue;
      this.helpers.remove(h);
      h.geometry.dispose();
      (Array.isArray(h.material) ? h.material : [h.material]).forEach((m) => m.dispose());
    }
    this.grid = this.axes = null;
  }

  fit(rebuild = false): void {
    this.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(this.root);
    if (box.isEmpty() || !Number.isFinite(box.min.x)) { box.set(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)); }
    this.box = box;
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    this.radius = Math.max(size.length() / 2, 1e-6);
    if (rebuild) this.buildHelpers();
    const dist = this.radius / Math.sin((this.camera.fov * Math.PI) / 360) * 1.05;
    this.camera.near = Math.max(dist / 1000, 1e-7);
    this.camera.far = dist * 80;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = this.radius * 0.02;
    this.controls.maxDistance = dist * 30;
    this.controls.target.copy(center);
    this.placeCamera(new Vector3(0.7, 0.5, 1).normalize(), dist);
    const markerScale = this.radius * 0.012;
    this.markers.forEach((m) => m.scale.setScalar(markerScale));
  }

  private placeCamera(dir: Vector3, dist: number): void {
    const target = this.controls.target;
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(target).addScaledVector(dir, dist);
    this.camera.lookAt(target);
    this.controls.update();
    this.request();
  }

  view(name: ViewName): void {
    const dist = this.radius / Math.sin((this.camera.fov * Math.PI) / 360) * 1.05;
    const dirs: Record<ViewName, Vector3> = {
      front: new Vector3(0, 0, 1),
      right: new Vector3(1, 0, 0),
      top: new Vector3(0, 1, 0.0001).normalize(),
      iso: new Vector3(1, 0.8, 1).normalize(),
    };
    this.controls.target.copy(this.box.getCenter(new Vector3()));
    this.placeCamera(dirs[name], dist);
  }

  private buildHelpers(): void {
    this.disposeHelpers();
    const size = this.box.getSize(new Vector3());
    const center = this.box.getCenter(new Vector3());
    const span = Math.max(size.x, size.z, this.radius * 0.5, 1e-6);
    const step = Math.pow(10, Math.floor(Math.log10(span)));
    const cell = span / step >= 5 ? step * 2 : span / step >= 2 ? step : step / 2;
    const cells = Math.max(2, Math.ceil((span * 1.6) / cell / 2) * 2);
    this.grid = new GridHelper(cells * cell, cells, 0x666666, 0x333333);
    this.grid.userData.divisions = cells;
    this.grid.userData.cell = cell;
    this.grid.position.set(center.x, this.box.min.y, center.z);
    this.grid.visible = this.showGrid;
    this.helpers.add(this.grid);
    this.axes = new AxesHelper(this.radius * 0.8);
    this.axes.visible = this.showAxes;
    this.helpers.add(this.axes);
    this.paintGrid();
  }

  gridCell(): number {
    return (this.grid?.userData.cell as number | undefined) ?? 0;
  }

  setGrid(on: boolean): void { this.showGrid = on; if (this.grid) this.grid.visible = on; this.request(); }
  setAxes(on: boolean): void { this.showAxes = on; if (this.axes) this.axes.visible = on; this.request(); }

  setUp(zUp: boolean): void {
    if (zUp === this.zUp) return;
    this.zUp = zUp;
    this.root.rotation.x = zUp ? -Math.PI / 2 : 0;
    this.setMeasuring(this.measuring);
    this.fit(true);
  }

  isZUp(): boolean { return this.zUp; }

  setMode(mode: RenderMode): void {
    this.mode = mode;
    this.root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (!this.originals.has(m)) this.originals.set(m, m.material);
      m.material = mode === 'lit' ? (this.originals.get(m) as Material | Material[]) : this.modeMats[mode];
    });
    this.request();
  }

  private restoreMaterials(): void {
    this.root.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && this.originals.has(m)) m.material = this.originals.get(m) as Material | Material[];
    });
  }

  setMeasuring(on: boolean): void {
    this.measuring = on;
    this.points = [];
    this.markers.forEach((m) => { m.visible = false; });
    this.measureLine.visible = false;
    this.hooks.measure(on ? { a: null, b: null, distance: 0 } : null);
    this.request();
  }

  private ndc(e: MouseEvent): Vector2 {
    const r = this.canvas.getBoundingClientRect();
    return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private pick(e: MouseEvent): Vector3 | null {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    this.raycaster.params.Points = { threshold: this.radius * 0.01 };
    this.raycaster.params.Line = { threshold: this.radius * 0.01 };
    const hits = this.raycaster.intersectObject(this.root, true).filter((h) => { for (let o: Object3D | null = h.object; o; o = o.parent) if (!o.visible) return false; return true; });
    return hits.length ? hits[0].point.clone() : null;
  }

  private onPointerUp(e: PointerEvent): void {
    const p = this.pointer;
    this.pointer = null;
    if (!p || e.button !== 0 || !this.measuring) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5 || performance.now() - p.t > 600) return;
    const hit = this.pick(e);
    if (!hit) return;
    if (this.points.length >= 2) this.points = [];
    this.points.push(hit);
    this.markers.forEach((m, i) => {
      const pt = this.points[i];
      m.visible = Boolean(pt);
      if (pt) m.position.copy(pt);
    });
    if (this.points.length === 2) {
      const [a, b] = this.points;
      this.measureLine.geometry.setFromPoints([a, b]);
      this.measureLine.visible = true;
      this.hooks.measure({ a: a.toArray(), b: b.toArray(), distance: a.distanceTo(b) });
    } else {
      this.measureLine.visible = false;
      this.hooks.measure({ a: hit.toArray(), b: null, distance: 0 });
    }
    this.request();
  }

  private onDouble(e: MouseEvent): void {
    if (this.measuring) return;
    const hit = this.pick(e);
    if (!hit) return;
    this.controls.target.copy(hit);
    this.controls.update();
    this.request();
  }

  private find(id: string): Object3D | null {
    return this.root.getObjectByProperty('uuid', id) ?? null;
  }

  select(id: string | null): void {
    this.selectedId = id;
    const o = id ? this.find(id) : null;
    if (o) {
      o.updateWorldMatrix(true, true);
      const b = new Box3().setFromObject(o);
      this.selection.visible = !b.isEmpty();
      this.selection.box.copy(b);
    } else {
      this.selection.visible = false;
      this.selectedId = null;
    }
    this.hooks.selected(this.selectedId);
    this.request();
  }

  setVisible(id: string, on: boolean): void {
    const o = this.find(id);
    if (!o) return;
    o.visible = on;
    this.countGeometry();
    if (this.selectedId) this.select(this.selectedId);
    this.request();
  }

  dump(): SceneDump {
    const nodes: NodeRow[] = [];
    const mats = new Map<string, { m: Material; uses: number }>();
    let truncated = false;
    const walk = (o: Object3D, parent: string | null, depth: number): void => {
      if (nodes.length >= MAX_NODES) { truncated = true; return; }
      const kind = kindOf(o);
      nodes.push({ id: o.uuid, parent, name: o.name || '', kind, depth, visible: o.visible, children: o.children.length, triangles: trianglesOf(o) });
      if (kind === 'mesh') {
        const list = this.originals.get(o as Mesh) ?? (o as Mesh).material;
        (Array.isArray(list) ? list : [list]).forEach((m) => {
          const e = mats.get(m.uuid);
          if (e) e.uses++; else mats.set(m.uuid, { m, uses: 1 });
        });
      }
      for (const c of o.children) walk(c, o.uuid, depth + 1);
    };
    for (const c of this.root.children) walk(c, null, 0);
    const materials: MaterialRow[] = [];
    for (const { m, uses } of mats.values()) {
      const textures: TextureRow[] = [];
      const rec = m as unknown as Record<string, unknown>;
      for (const slot of TEXTURE_SLOTS) {
        const t = rec[slot] as Texture | null | undefined;
        if (t && t.isTexture) {
          const [w, h] = textureSize(t);
          textures.push({ slot, name: t.name, width: w, height: h });
        }
      }
      const col = (rec.color as Color | undefined)?.isColor ? '#' + (rec.color as Color).getHexString() : '';
      materials.push({ id: m.uuid, name: m.name, type: m.type, color: col, uses, textures });
    }
    return { nodes, materials, truncated };
  }

  clipList(): ClipRow[] {
    return this.clips.map((c) => ({ name: c.name, duration: c.duration }));
  }

  private bindClip(i: number): void {
    if (!this.mixer || !this.clips[i]) return;
    this.mixer.stopAllAction();
    this.clipIndex = i;
    this.action = this.mixer.clipAction(this.clips[i]);
    this.action.reset().play();
    this.mixer.update(0);
    this.emitPlayback();
  }

  setClip(i: number): void {
    const was = this.playing;
    this.pause();
    this.bindClip(i);
    this.request();
    if (was) this.play();
  }

  setSpeed(s: number): void { this.speed = s; }

  play(): void {
    if (!this.mixer || !this.action || this.playing) return;
    this.playing = true;
    this.lastTick = performance.now();
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    const tick = (now: number): void => {
      if (!this.playing || this.disposed) { this.loopRaf = 0; return; }
      const dt = Math.min((now - this.lastTick) / 1000, 0.25);
      this.lastTick = now;
      this.mixer?.update(dt * this.speed);
      this.renderer.render(this.scene, this.camera);
      this.hooks.stats(this.stats());
      this.emitPlayback();
      this.loopRaf = requestAnimationFrame(tick);
    };
    this.loopRaf = requestAnimationFrame(tick);
    this.emitPlayback();
  }

  pause(): void {
    this.playing = false;
    if (this.loopRaf) { cancelAnimationFrame(this.loopRaf); this.loopRaf = 0; }
    this.emitPlayback();
  }

  toggle(): void { if (this.playing) this.pause(); else this.play(); }

  seek(t: number): void {
    if (!this.mixer || !this.action) return;
    this.action.time = Math.max(0, Math.min(this.clips[this.clipIndex].duration, t));
    this.mixer.update(0);
    this.emitPlayback();
    this.request();
  }

  hasClips(): boolean { return this.clips.length > 0; }

  private emitPlayback(): void {
    const clip = this.clips[this.clipIndex];
    this.hooks.playback({ playing: this.playing, time: this.action?.time ?? 0, duration: clip?.duration ?? 0 });
  }

  screenshot(): Promise<Blob | null> {
    this.renderer.render(this.scene, this.camera);
    return new Promise((resolve) => this.canvas.toBlob((b) => resolve(b), 'image/png'));
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.theme.disconnect();
    this.cleanups.forEach((f) => f());
    this.controls.dispose();
    Object.values(this.modeMats).forEach((m) => m.dispose());
    this.matcap.dispose();
    this.sphereGeo.dispose();
    this.measureLine.geometry.dispose();
    (this.measureLine.material as Material).dispose();
    this.markers.forEach((m) => (m.material as Material).dispose());
    this.selection.geometry.dispose();
    (this.selection.material as Material).dispose();
    this.envTarget.dispose();
    this.probe.remove();
    this.renderer.dispose();
  }
}
