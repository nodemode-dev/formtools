import { baseName, fmtBytes, type UsageCategory, type UsageNode } from '../../io/util-api';
import { el, patchList, q, setClass, setStyleVar, setText } from '../dom';
import { CATEGORIES, CATEGORY_INDEX, CATEGORY_LABEL, nodeCategory, pct, readPalette, type Palette } from './categories';
import { nest, navigable, type Tile } from './treemap';

const AMBIENT = 0.2;
const DIRECT = 0.85;
const LIGHT: [number, number, number] = [-1, -1, 10];
const LIGHT_LEN = Math.hypot(...LIGHT);
const RIDGE = 0.38;
const FALLOFF = 0.91;
const PAD = 2;
const MIN_SIDE = 6;
const MAX_TILES = 24000;
const BAND = 14;
const LABEL_W = 84;
const LABEL_H = 44;

interface LegendItem { id: UsageCategory; label: string }

export class HeatmapPane {
  readonly root = el<HTMLElement>(`<div class="ft-du-heat" hidden>
      <div class="ft-du-hwrap">
        <canvas class="ft-du-canvas" role="img" aria-label="Nested treemap of files coloured by type"></canvas>
        <div class="ft-du-hbox"></div>
        <div class="ft-du-tip" role="tooltip"><div class="ft-du-tip-name"></div><div class="ft-du-tip-path"></div>
          <div class="ft-du-tip-row"><span>Size</span><b class="ft-du-tip-size"></b></div>
          <div class="ft-du-tip-row"><span>On disk</span><b class="ft-du-tip-alloc"></b></div>
          <div class="ft-du-tip-row"><span>Type</span><b class="ft-du-tip-type"></b></div></div>
        <p class="ft-note ft-du-empty">Measure a folder to see its files as a heatmap.</p>
      </div>
      <div class="ft-du-legend" role="group" aria-label="File types"></div>
    </div>`);
  private readonly wrap = q(this.root, '.ft-du-hwrap');
  private readonly canvas = q<HTMLCanvasElement>(this.root, '.ft-du-canvas');
  private readonly ctx = this.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
  private readonly tip = q(this.root, '.ft-du-tip');
  private readonly box = q(this.root, '.ft-du-hbox');
  private readonly legend = q(this.root, '.ft-du-legend');
  private here: UsageNode | null = null;
  private tiles: Tile[] = [];
  private leaves: Tile[] = [];
  private cells = new Int32Array(0);
  private shade = new Uint8Array(0);
  private image: ImageData | null = null;
  private palette: Palette | null = null;
  private dpr = 1;
  private cw = 0;
  private ch = 0;
  private hot: UsageCategory | null = null;
  private filter: UsageCategory | null = null;
  private hover = -1;
  private needPlan = true;
  private needPaint = true;
  private frame = 0;
  private visible = false;

  constructor(private readonly enter: (node: UsageNode) => void) {
    this.buildLegend();
    new ResizeObserver(() => this.schedule(true)).observe(this.wrap);
    const refresh = (): void => { this.palette = null; this.schedule(false); };
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    this.canvas.addEventListener('pointermove', (e) => this.point(e));
    this.canvas.addEventListener('pointerleave', () => this.leave());
    this.canvas.addEventListener('click', (e) => this.click(e));
    this.legend.addEventListener('pointerover', (e) => {
      const id = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-lg]') : null)?.dataset.lg as UsageCategory | undefined;
      this.setHot(id ?? null);
    });
    this.legend.addEventListener('pointerleave', () => this.setHot(null));
    this.legend.addEventListener('click', (e) => {
      const id = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-lg]') : null)?.dataset.lg as UsageCategory | undefined;
      if (id) this.setFilter(this.filter === id ? null : id);
    });
  }

  get filtered(): UsageCategory | null { return this.filter; }

  setVisible(on: boolean): void {
    this.visible = on;
    if (on) this.schedule(false);
  }

  setData(here: UsageNode | null): void {
    this.here = here;
    this.hover = -1;
    this.leave();
    setClass(this.root, 'has-data', !!here);
    this.updateLegend();
    this.schedule(true);
  }

  private buildLegend(): void {
    const items: LegendItem[] = CATEGORIES.map((c) => ({ id: c.id, label: c.label }));
    patchList(this.legend, items, {
      key: (i) => i.id,
      create: (i) => {
        const b = el<HTMLElement>(`<button type="button" class="ft-du-lg" data-lg="${i.id}" data-cat="${i.id}"><span class="ft-sw"></span><span class="ft-du-lgname"></span><span class="ft-du-lgpct"></span><span class="ft-du-lgbytes"></span></button>`);
        setText(q(b, '.ft-du-lgname'), i.label);
        return b;
      },
      update: () => undefined,
    });
  }

  private updateLegend(): void {
    const here = this.here;
    const total = here?.size ?? 0;
    this.legend.querySelectorAll<HTMLElement>('[data-lg]').forEach((b) => {
      const id = b.dataset.lg as UsageCategory;
      const v = here?.types?.[id] ?? 0;
      setText(q(b, '.ft-du-lgpct'), v > 0 ? pct(v, total) : '');
      setText(q(b, '.ft-du-lgbytes'), v > 0 ? fmtBytes(v) : '');
      setClass(b, 'is-empty', v <= 0);
      b.setAttribute('aria-pressed', this.filter === id ? 'true' : 'false');
    });
  }

  private setHot(id: UsageCategory | null): void {
    if (this.hot === id) return;
    this.hot = id;
    this.schedule(false);
  }

  private setFilter(id: UsageCategory | null): void {
    this.filter = id;
    this.legend.querySelectorAll<HTMLElement>('[data-lg]').forEach((b) => {
      const on = b.dataset.lg === id;
      setClass(b, 'is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    this.schedule(false);
  }

  private schedule(plan: boolean): void {
    if (plan) this.needPlan = true;
    this.needPaint = true;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.run(); });
  }

  private run(): void {
    if (!this.visible) return;
    const w = this.wrap.clientWidth;
    const h = this.wrap.clientHeight;
    if (w <= 0 || h <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (w !== this.cw || h !== this.ch || dpr !== this.dpr) {
      this.cw = w; this.ch = h; this.dpr = dpr;
      this.canvas.width = Math.max(1, Math.round(w * dpr));
      this.canvas.height = Math.max(1, Math.round(h * dpr));
      this.needPlan = true;
    }
    if (!this.here) { this.clear(); return; }
    if (this.needPlan) { const t0 = performance.now(); this.leave(); this.plan(); performance.measure('ft-heat-plan', { start: t0, end: performance.now(), detail: { tiles: this.tiles.length, leaves: this.leaves.length } }); this.needPlan = false; }
    if (this.needPaint) { const t0 = performance.now(); this.paint(); performance.measure('ft-heat-paint', { start: t0, end: performance.now() }); this.needPaint = false; }
  }

  private clear(): void {
    const p = this.palette ?? (this.palette = readPalette(this.root));
    this.ctx.fillStyle = `rgb(${p.background[0]},${p.background[1]},${p.background[2]})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.tiles = [];
    this.leaves = [];
    this.needPaint = false;
  }

  private plan(): void {
    const here = this.here as UsageNode;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const dpr = this.dpr;
    this.tiles = nest(here, { x: 0, y: 0, w: this.cw, h: this.ch }, { pad: PAD, minSide: MIN_SIDE, ridge: RIDGE, falloff: FALLOFF, maxTiles: MAX_TILES, band: BAND, labelW: LABEL_W, labelH: LABEL_H });
    this.leaves = this.tiles.filter((t) => t.leaf);
    if (this.cells.length !== W * H) { this.cells = new Int32Array(W * H); this.shade = new Uint8Array(W * H); this.image = null; }
    this.cells.fill(-1);
    this.shade.fill(0);
    const nx = new Float32Array(W + 1);
    const nx2 = new Float32Array(W + 1);
    const lx = LIGHT[0] / LIGHT_LEN;
    const ly = LIGHT[1] / LIGHT_LEN;
    const lz = LIGHT[2] / LIGHT_LEN;
    for (let id = 0; id < this.tiles.length; id += 1) {
      const t = this.tiles[id];
      if (!t.leaf) continue;
      const x0 = Math.max(0, Math.round(t.x * dpr));
      const x1 = Math.min(W, Math.round((t.x + t.w) * dpr));
      const y0 = Math.max(0, Math.round(t.y * dpr));
      const y1 = Math.min(H, Math.round((t.y + t.h) * dpr));
      if (x1 <= x0 || y1 <= y0) continue;
      for (let ix = x0; ix < x1; ix += 1) {
        const cx = (ix + 0.5) / dpr;
        const v = -(2 * t.s0 * cx + t.s2);
        nx[ix - x0] = v * lx;
        nx2[ix - x0] = v * v + 1;
      }
      for (let iy = y0; iy < y1; iy += 1) {
        const cy = (iy + 0.5) / dpr;
        const ny = -(2 * t.s1 * cy + t.s3);
        const base = ny * ly + lz;
        const ny2 = ny * ny;
        const row = iy * W;
        for (let ix = x0; ix < x1; ix += 1) {
          const k = ix - x0;
          const cos = (nx[k] + base) / Math.sqrt(nx2[k] + ny2);
          const s = AMBIENT + DIRECT * (cos > 0 ? cos : 0);
          this.shade[row + ix] = s >= 1 ? 255 : (s * 255) | 0;
          this.cells[row + ix] = id;
        }
      }
    }
  }

  private lut(p: Palette): Uint32Array {
    const out = new Uint32Array(CATEGORIES.length * 256 + 256);
    const active = this.filter ?? this.hot;
    const fade = this.filter ? 0.9 : 0.78;
    const bg = p.background;
    for (let c = 0; c < CATEGORIES.length; c += 1) {
      const base = p.colors[c];
      const off = active !== null && CATEGORY_INDEX[active] !== c;
      for (let s = 0; s < 256; s += 1) {
        const f = s / 255;
        let r = base[0] * f;
        let g = base[1] * f;
        let b = base[2] * f;
        if (off) { r = r * (1 - fade) + bg[0] * fade; g = g * (1 - fade) + bg[1] * fade; b = b * (1 - fade) + bg[2] * fade; }
        out[c * 256 + s] = (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
      }
    }
    return out;
  }

  private paint(): void {
    const p = this.palette ?? (this.palette = readPalette(this.root));
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!this.image || this.image.width !== W || this.image.height !== H) this.image = this.ctx.createImageData(W, H);
    const lut = this.lut(p);
    const bgPixel = (255 << 24) | (p.background[2] << 16) | (p.background[1] << 8) | p.background[0];
    const cat = new Int16Array(this.tiles.length);
    for (let i = 0; i < this.tiles.length; i += 1) cat[i] = CATEGORY_INDEX[nodeCategory(this.tiles[i].node)] * 256;
    const px = new Uint32Array(this.image.data.buffer);
    const cells = this.cells;
    const shade = this.shade;
    for (let i = 0; i < px.length; i += 1) {
      const c = cells[i];
      px[i] = c < 0 ? bgPixel : lut[cat[c] + shade[i]];
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.edges(p);
  }

  private edges(p: Palette): void {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const bg = p.background;
    for (const t of this.tiles) {
      if (t.leaf || t.depth === 0) continue;
      const lw = Math.max(1, Math.round((t.depth <= 1 ? 2.5 : t.depth === 2 ? 1.75 : 1) * dpr));
      ctx.lineWidth = lw;
      ctx.strokeStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},${t.depth <= 1 ? 0.95 : t.depth === 2 ? 0.75 : 0.5})`;
      const x = Math.round(t.x * dpr) + lw / 2;
      const y = Math.round(t.y * dpr) + lw / 2;
      const w = Math.round((t.x + t.w) * dpr) - Math.round(t.x * dpr) - lw;
      const h = Math.round((t.y + t.h) * dpr) - Math.round(t.y * dpr) - lw;
      if (w > 0 && h > 0) ctx.strokeRect(x, y, w, h);
    }
    ctx.textBaseline = 'top';
    ctx.font = `600 ${Math.round(11 * dpr)}px ${p.font}`;
    ctx.lineJoin = 'round';
    for (const t of this.tiles) {
      if (t.depth === 0 || t.w < LABEL_W || t.h < 26) continue;
      if (!t.leaf && (t.depth > 1 || t.h < LABEL_H)) continue;
      if (t.leaf && t.depth > 2) continue;
      const label = t.node.name || baseName(t.node.path ?? '');
      const x = Math.round((t.x + 5) * dpr);
      const y = Math.round((t.y + 4) * dpr);
      const room = (t.w - 10) * dpr;
      let text = label;
      while (text.length > 1 && ctx.measureText(text).width > room) text = text.slice(0, -2);
      if (text !== label) text += '...';
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, x, y);
    }
  }

  private hit(e: PointerEvent): number {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) * this.dpr);
    const y = Math.floor((e.clientY - r.top) * this.dpr);
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return -1;
    return this.cells[y * this.canvas.width + x] ?? -1;
  }

  private point(e: PointerEvent): void {
    const id = this.hit(e);
    const r = this.wrap.getBoundingClientRect();
    if (id < 0) { this.leave(); return; }
    if (id !== this.hover) {
      this.hover = id;
      const t = this.tiles[id];
      const n = t.node;
      setText(q(this.tip, '.ft-du-tip-name'), n.name || baseName(n.path ?? ''));
      setText(q(this.tip, '.ft-du-tip-path'), n.other ? (n.path ?? '') : (n.path ?? n.name));
      setText(q(this.tip, '.ft-du-tip-size'), `${fmtBytes(n.size)} (${pct(n.size, this.here?.size ?? 0)})`);
      setText(q(this.tip, '.ft-du-tip-alloc'), n.allocated !== undefined ? fmtBytes(n.allocated) : 'Not measured');
      const cat = nodeCategory(n);
      setText(q(this.tip, '.ft-du-tip-type'), n.other ? `${CATEGORY_LABEL[cat]} and more` : n.children?.length || n.dir ? `Folder, mostly ${CATEGORY_LABEL[cat].toLowerCase()}` : `${n.ext ? `.${n.ext}` : 'No extension'}, ${CATEGORY_LABEL[cat]}`);
      setStyleVar(this.box, '--x', `${t.x.toFixed(1)}px`);
      setStyleVar(this.box, '--y', `${t.y.toFixed(1)}px`);
      setStyleVar(this.box, '--w', `${t.w.toFixed(1)}px`);
      setStyleVar(this.box, '--h', `${t.h.toFixed(1)}px`);
      setClass(this.box, 'is-on', true);
      setClass(this.canvas, 'is-link', navigable(this.tiles[t.top].node));
    }
    const tw = this.tip.offsetWidth;
    const th = this.tip.offsetHeight;
    const px = Math.min(Math.max(4, e.clientX - r.left + 14), Math.max(4, r.width - tw - 4));
    const py = Math.min(Math.max(4, e.clientY - r.top + 16), Math.max(4, r.height - th - 4));
    this.tip.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px)`;
    setClass(this.tip, 'is-on', true);
  }

  private leave(): void {
    this.hover = -1;
    setClass(this.tip, 'is-on', false);
    setClass(this.box, 'is-on', false);
  }

  private click(e: PointerEvent | MouseEvent): void {
    const id = this.hit(e as PointerEvent);
    if (id < 0) return;
    const top = this.tiles[this.tiles[id].top];
    if (top && navigable(top.node)) this.enter(top.node);
  }
}
