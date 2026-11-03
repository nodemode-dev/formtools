import { api, type Entry, type ImageInfo, type TransformOp } from '../io/api';
import { delayedIndicator, el, escapeHtml, patchList, q, setClass, setHidden, setText, type Disposer } from './dom';
import { icon } from './icons';
import { loadPrefs, onPrefs } from './prefs';
import { toast } from './toast';

export interface ViewerDeps {
  close: (path: string | null) => void;
  status: (text: string) => void;
  title: (name: string) => void;
  openIn: (entry: Entry) => void;
  reveal: (path: string) => void;
}

const NATIVE_IMAGE = new Set(['jpg', 'jpeg', 'jpe', 'jfif', 'png', 'apng', 'gif', 'webp', 'bmp', 'svg']);
const NATIVE_VIDEO = new Set(['mp4', 'm4v', 'webm', 'mov', 'ogv']);
const NATIVE_AUDIO = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba']);
const MIN_ZOOM = 0.02, MAX_ZOOM = 64;

type Kind = 'image' | 'video' | 'audio' | 'none';

interface View { zoom: number; x: number; y: number; mode: 'fit' | 'fill' | 'actual' | 'free' }

interface Pane {
  box: HTMLElement;
  img: HTMLImageElement;
  w: number;
  h: number;
  src: string;
  probe: HTMLImageElement | null;
}

const kindOf = (e: Entry): Kind => {
  if (e.type === 'video' && NATIVE_VIDEO.has(e.ext)) return 'video';
  if (e.type === 'audio' && NATIVE_AUDIO.has(e.ext)) return 'audio';
  if (e.type === 'image' || e.type === 'family') return 'image';
  return 'none';
};

const srcOf = (e: Entry, stamp: number): string =>
  e.type === 'image' && NATIVE_IMAGE.has(e.ext) ? api.rawUrl(e.path, e.mtime + stamp) : api.viewUrl(e.path, 0, e.mtime + stamp);

const probes = new Map<string, HTMLImageElement>();

function cancel(src: string): void {
  const probe = probes.get(src);
  if (probe && !probe.complete) probe.src = '';
  probes.delete(src);
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const probe = new Image();
    probes.set(src, probe);
    probe.decoding = 'async';
    probe.onload = () => { void (probe.decode ? probe.decode().catch(() => undefined) : Promise.resolve()).then(() => resolve(probe)); };
    probe.onerror = () => reject(new Error('load failed'));
    probe.src = src;
  });
}

export class Viewer {
  readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly panes: Pane[];
  private readonly video: HTMLVideoElement;
  private readonly audio: HTMLAudioElement;
  private readonly message: HTMLElement;
  private readonly zoomLabel: HTMLElement;
  private readonly info: HTMLElement;
  private readonly infoRows: HTMLElement;
  private readonly hist: HTMLCanvasElement;
  private entries: Entry[] = [];
  private index = -1;
  private view: View = { zoom: 1, x: 0, y: 0, mode: 'fit' };
  private compare = false;
  private locked = false;
  private slideTimer = 0;
  private seq = 0;
  private stamps = new Map<string, number>();
  private readonly cache = new Map<string, Promise<HTMLImageElement>>();
  private drag: { x: number; y: number; vx: number; vy: number } | null = null;
  private stopBusy: Disposer | null = null;
  private infoSeq = 0;
  quick = false;

  constructor(private readonly deps: ViewerDeps) {
    this.root = el<HTMLElement>(`
      <section class="ft-viewer ft-page" aria-label="Viewer" data-page="view" hidden>
        <div class="ft-vbar">
          <button class="cv-tt-btn" type="button" data-act="back" title="Back to the browser (Escape)" aria-label="Back">${icon('chevronLeft', 16)}</button>
          <span class="ft-vbar-name"></span>
          <span class="ft-vbar-count"></span>
          <span class="ft-vbar-gap"></span>
          <button class="cv-tt-btn" type="button" data-act="prev" title="Previous (Left)" aria-label="Previous">${icon('ftPrev', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="next" title="Next (Right)" aria-label="Next">${icon('ftNext', 16)}</button>
          <span class="ft-vbar-sep"></span>
          <button class="cv-tt-btn" type="button" data-act="fit" title="Fit (F)" aria-label="Fit">${icon('ftFit', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="actual" title="Actual pixels (1)" aria-label="Actual pixels">${icon('ftActual', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="zoom-out" title="Zoom out (-)" aria-label="Zoom out">${icon('zoomOut', 16)}</button>
          <span class="ft-zoom" aria-live="polite"></span>
          <button class="cv-tt-btn" type="button" data-act="zoom-in" title="Zoom in (+)" aria-label="Zoom in">${icon('zoomIn', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="lock" title="Keep zoom between images (L)" aria-label="Lock zoom">${icon('lock', 16)}</button>
          <span class="ft-vbar-sep"></span>
          <button class="cv-tt-btn" type="button" data-act="rotate-ccw" title="Rotate left, saved losslessly where possible" aria-label="Rotate left">${icon('undo', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="rotate-cw" title="Rotate right, saved losslessly where possible" aria-label="Rotate right">${icon('rotate', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="flip-h" title="Flip horizontally" aria-label="Flip horizontally">${icon('flipH', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="flip-v" title="Flip vertically" aria-label="Flip vertically">${icon('flipV', 16)}</button>
          <span class="ft-vbar-sep"></span>
          <button class="cv-tt-btn" type="button" data-act="compare" title="Compare with the next image (C)" aria-label="Compare">${icon('ftCompare', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="slides" title="Slideshow (S)" aria-label="Slideshow">${icon('ftSlides', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="full" title="Full screen (F11)" aria-label="Full screen">${icon('ftFullscreen', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="info" title="Information (I)" aria-label="Information">${icon('info', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="open-in" title="Open in its app" aria-label="Open in its app">${icon('ftOpenIn', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="reveal" title="Show in folder" aria-label="Show in folder">${icon('folderOpen', 16)}</button>
          <span class="ft-vbar-busy" aria-hidden="true"></span>
        </div>
        <div class="ft-vbody">
          <div class="ft-stage" tabindex="0" aria-label="Image">
            <div class="ft-pane"><img class="ft-img" alt="" draggable="false"></div>
            <div class="ft-pane" hidden><img class="ft-img" alt="" draggable="false"></div>
            <video class="ft-video" controls preload="metadata" hidden></video>
            <div class="ft-audio-box" hidden>${icon('ftAudio', 48)}<audio class="ft-audio" controls preload="metadata"></audio></div>
            <p class="ft-vmsg" hidden></p>
          </div>
          <aside class="ft-info" hidden>
            <div class="ft-info-title">Information</div>
            <canvas class="ft-hist" width="256" height="96" aria-label="Histogram"></canvas>
            <dl class="ft-info-rows"></dl>
          </aside>
        </div>
      </section>`);
    this.stage = q(this.root, '.ft-stage');
    this.panes = Array.from(this.root.querySelectorAll<HTMLElement>('.ft-pane')).map((box) => ({ box, img: q<HTMLImageElement>(box, '.ft-img'), w: 0, h: 0, src: '', probe: null }));
    this.video = q(this.root, '.ft-video');
    this.audio = q(this.root, '.ft-audio');
    this.message = q(this.root, '.ft-vmsg');
    this.zoomLabel = q(this.root, '.ft-zoom');
    this.info = q(this.root, '.ft-info');
    this.infoRows = q(this.root, '.ft-info-rows');
    this.hist = q(this.root, '.ft-hist');
    this.wire();
    onPrefs((p) => { setClass(this.stage, 'is-checker', p.viewerBackground === 'checker'); setClass(this.stage, 'is-black', p.viewerBackground === 'black'); });
    setClass(this.stage, 'is-checker', loadPrefs().viewerBackground === 'checker');
    setClass(this.stage, 'is-black', loadPrefs().viewerBackground === 'black');
  }

  private wire(): void {
    q(this.root, '.ft-vbar').addEventListener('click', (e) => {
      const act = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]') : null)?.dataset.act;
      if (act) this.act(act);
    });
    this.stage.addEventListener('wheel', (e) => {
      if (this.kind() !== 'image') return;
      e.preventDefault();
      const r = this.stage.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      this.zoomAt(this.view.zoom * f, e.clientX - r.left - r.width / this.paneCount() / 2 - (this.paneIndexAt(e.clientX) * r.width) / this.paneCount(), e.clientY - r.top - r.height / 2);
    }, { passive: false });
    this.stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.kind() !== 'image') return;
      this.stage.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
      setClass(this.stage, 'is-dragging', true);
    });
    this.stage.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.view = { ...this.view, mode: 'free', x: this.drag.vx + e.clientX - this.drag.x, y: this.drag.vy + e.clientY - this.drag.y };
      this.apply();
    });
    const end = (): void => { this.drag = null; setClass(this.stage, 'is-dragging', false); };
    this.stage.addEventListener('pointerup', end);
    this.stage.addEventListener('pointercancel', end);
    this.stage.addEventListener('dblclick', () => this.setMode(this.view.mode === 'actual' ? 'fit' : 'actual'));
    this.stage.addEventListener('keydown', (e) => this.key(e));
    new ResizeObserver(() => { if (this.view.mode !== 'free') this.setMode(this.view.mode); }).observe(this.stage);
    document.addEventListener('fullscreenchange', () => setClass(this.root, 'is-full', document.fullscreenElement === this.root));
  }

  get current(): Entry | null { return this.entries[this.index] ?? null; }

  private kind(): Kind { const c = this.current; return c ? kindOf(c) : 'none'; }

  private paneCount(): number { return this.compare ? 2 : 1; }

  private paneIndexAt(clientX: number): number {
    if (!this.compare) return 0;
    const r = this.stage.getBoundingClientRect();
    return clientX - r.left > r.width / 2 ? 1 : 0;
  }

  open(entries: Entry[], index: number): void {
    this.entries = entries;
    this.cache.clear();
    void this.show(Math.max(0, index));
    this.stage.focus({ preventScroll: true });
  }

  private async show(i: number): Promise<void> {
    if (i < 0 || i >= this.entries.length) return;
    const seq = ++this.seq;
    this.index = i;
    const e = this.entries[i];
    setText(q(this.root, '.ft-vbar-name'), e.name);
    setText(q(this.root, '.ft-vbar-count'), `${i + 1} of ${this.entries.length}`);
    this.deps.title(e.name);
    const k = kindOf(e);
    this.setMedia(k);
    if (k === 'video' || k === 'audio') {
      const m = k === 'video' ? this.video : this.audio;
      const src = api.rawUrl(e.path, e.mtime);
      if (m.getAttribute('src') !== src) m.src = src;
      this.deps.status(`${e.name} · ${e.ext.toUpperCase()}`);
      setHidden(this.message, true);
      this.syncInfo(e, null);
      return;
    }
    if (k === 'none') {
      setText(this.message, `formtools cannot show .${e.ext || 'this'} files yet. Use Open in its app, or Show in folder.`);
      setHidden(this.message, false);
      this.deps.status(e.name);
      this.syncInfo(e, null);
      return;
    }
    this.stopBusy?.();
    const busy = q(this.root, '.ft-vbar-busy');
    this.stopBusy = delayedIndicator(
      () => { setClass(busy, 'is-on', true); setClass(this.stage, 'is-loading', true); },
      () => { setClass(busy, 'is-on', false); setClass(this.stage, 'is-loading', false); },
    );
    try {
      await this.place(0, e, seq);
      if (this.compare) await this.place(1, this.entries[i + 1] ?? null, seq);
      if (seq !== this.seq) return;
      setHidden(this.message, true);
      this.setMode(this.locked ? this.view.mode : loadPrefs().viewerFit, this.locked);
      this.syncInfo(e, this.panes[0]);
    } catch {
      if (seq !== this.seq) return;
      setText(this.message, `formtools could not read ${e.name}.`);
      setHidden(this.message, false);
    } finally {
      if (seq === this.seq) { this.stopBusy?.(); this.stopBusy = null; }
    }
    window.setTimeout(() => { if (seq === this.seq) this.prefetch(); }, 350);
    this.restartSlides();
  }

  private async place(n: number, e: Entry | null, seq: number): Promise<void> {
    const pane = this.panes[n];
    if (!e || kindOf(e) !== 'image') { pane.img.removeAttribute('src'); pane.src = ''; pane.w = pane.h = 0; pane.probe = null; return; }
    const src = srcOf(e, this.stamps.get(e.path) ?? 0);
    const probe = await this.get(src);
    if (seq !== this.seq) return;
    pane.probe = probe;
    pane.w = probe.naturalWidth;
    pane.h = probe.naturalHeight;
    pane.src = src;
    if (pane.img.getAttribute('src') !== src) pane.img.src = src;
    pane.img.style.width = `${pane.w}px`;
    pane.img.style.height = `${pane.h}px`;
  }

  private get(src: string): Promise<HTMLImageElement> {
    let p = this.cache.get(src);
    if (!p) {
      p = load(src);
      this.cache.set(src, p);
      p.catch(() => this.cache.delete(src));
    }
    return p;
  }

  private prefetch(): void {
    const n = loadPrefs().prefetch;
    const keep = new Set<string>();
    for (let d = -n; d <= n + (this.compare ? 1 : 0); d++) {
      const e = this.entries[this.index + d];
      if (!e || kindOf(e) !== 'image') continue;
      const src = srcOf(e, this.stamps.get(e.path) ?? 0);
      keep.add(src);
      if (d !== 0) void this.get(src).catch(() => undefined);
    }
    for (const k of [...this.cache.keys()]) if (!keep.has(k)) { this.cache.delete(k); cancel(k); }
  }

  private setMedia(k: Kind): void {
    setHidden(this.panes[0].box, k !== 'image');
    setHidden(this.panes[1].box, k !== 'image' || !this.compare);
    setHidden(this.video, k !== 'video');
    setHidden(q(this.root, '.ft-audio-box'), k !== 'audio');
    if (k !== 'video' && !this.video.paused) this.video.pause();
    if (k !== 'audio' && !this.audio.paused) this.audio.pause();
    setClass(this.root, 'is-media', k === 'video' || k === 'audio');
  }

  private fitZoom(mode: 'fit' | 'fill'): number {
    const p = this.panes[0];
    if (!p.w || !p.h) return 1;
    const r = this.stage.getBoundingClientRect();
    const w = r.width / this.paneCount(), h = r.height;
    const z = mode === 'fit' ? Math.min(w / p.w, h / p.h) : Math.max(w / p.w, h / p.h);
    return mode === 'fit' ? Math.min(1, z) : z;
  }

  private setMode(mode: View['mode'], keep = false): void {
    if (keep && mode === 'free') { this.apply(); return; }
    if (mode === 'free') { this.apply(); return; }
    const zoom = mode === 'actual' ? 1 : this.fitZoom(mode);
    this.view = { zoom, x: 0, y: 0, mode };
    this.apply();
  }

  private zoomAt(target: number, ox: number, oy: number): void {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target));
    const k = z / this.view.zoom;
    this.view = { zoom: z, x: ox - (ox - this.view.x) * k, y: oy - (oy - this.view.y) * k, mode: 'free' };
    this.apply();
  }

  private apply(): void {
    const { zoom, x, y } = this.view;
    for (const p of this.panes) {
      if (!p.w) continue;
      p.img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${zoom})`;
    }
    setClass(this.stage, 'is-pixelated', zoom >= 2);
    setText(this.zoomLabel, `${Math.round(zoom * 100)}%`);
    const p = this.panes[0];
    if (p.w && !this.root.hidden) this.deps.status(`${this.current?.name ?? ''} · ${p.w} x ${p.h} px · ${Math.round(zoom * 100)}%`);
  }

  private act(act: string): void {
    const e = this.current;
    switch (act) {
      case 'back': this.close(); break;
      case 'prev': this.step(-1); break;
      case 'next': this.step(1); break;
      case 'fit': this.setMode(this.view.mode === 'fit' ? 'fill' : 'fit'); break;
      case 'actual': this.setMode('actual'); break;
      case 'zoom-in': this.zoomAt(this.view.zoom * 1.25, 0, 0); break;
      case 'zoom-out': this.zoomAt(this.view.zoom / 1.25, 0, 0); break;
      case 'lock': this.locked = !this.locked; setClass(q(this.root, '[data-act="lock"]'), 'is-on', this.locked); break;
      case 'rotate-ccw': case 'rotate-cw': case 'flip-h': case 'flip-v': void this.transform(act); break;
      case 'compare': this.toggleCompare(); break;
      case 'slides': this.toggleSlides(); break;
      case 'full': void this.toggleFull(); break;
      case 'info': this.toggleInfo(); break;
      case 'open-in': if (e) this.deps.openIn(e); break;
      case 'reveal': if (e) this.deps.reveal(e.path); break;
      default: break;
    }
  }

  step(d: number): void {
    if (!this.entries.length) return;
    const n = this.entries.length;
    void this.show((this.index + d + n) % n);
  }

  private toggleCompare(): void {
    this.compare = !this.compare;
    setClass(this.stage, 'is-compare', this.compare);
    setClass(q(this.root, '[data-act="compare"]'), 'is-on', this.compare);
    void this.show(this.index);
  }

  private toggleSlides(): void {
    const on = !this.slideTimer;
    setClass(q(this.root, '[data-act="slides"]'), 'is-on', on);
    if (on) this.restartSlides(true); else { window.clearTimeout(this.slideTimer); this.slideTimer = 0; }
  }

  private restartSlides(force = false): void {
    if (!this.slideTimer && !force) return;
    window.clearTimeout(this.slideTimer);
    this.slideTimer = window.setTimeout(() => this.step(1), loadPrefs().slideshowSeconds * 1000);
  }

  private async toggleFull(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.root.requestFullscreen();
    } catch {
      toast('Full screen is not available here.', 'error');
    }
  }

  private toggleInfo(): void {
    const show = this.info.hidden !== false;
    setHidden(this.info, !show);
    setClass(q(this.root, '[data-act="info"]'), 'is-on', show);
    const e = this.current;
    if (show && e) this.syncInfo(e, kindOf(e) === 'image' ? this.panes[0] : null);
    if (this.view.mode !== 'free') requestAnimationFrame(() => this.setMode(this.view.mode));
  }

  private async transform(op: TransformOp): Promise<void> {
    const e = this.current;
    if (!e || e.type !== 'image') return;
    if (loadPrefs().confirmTransform && !window.confirm(`Save ${e.name} turned or flipped?`)) return;
    try {
      const r = await api.transform(e.path, op);
      this.stamps.set(e.path, (this.stamps.get(e.path) ?? 0) + 1);
      toast(r.lossless_used ? 'Saved without re-encoding.' : 'Saved at full quality.');
      void this.show(this.index);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The change was not saved.', 'error');
    }
  }

  private syncInfo(e: Entry, pane: Pane | null): void {
    if (this.info.hidden) return;
    const seq = ++this.infoSeq;
    const base: Array<[string, string]> = [['Name', e.name], ['Folder', e.path.slice(0, Math.max(0, e.path.length - e.name.length - 1))], ['Size', `${e.size.toLocaleString()} bytes`], ['Modified', new Date(e.mtime * 1000).toLocaleString()]];
    this.rows(base);
    this.drawHist(pane);
    if (e.type !== 'image' && e.type !== 'family') return;
    void api.info(e.path).then((info) => { if (seq === this.infoSeq) this.rows([...base, ...this.infoRowsOf(info)]); }).catch(() => undefined);
  }

  private infoRowsOf(i: ImageInfo): Array<[string, string]> {
    const rows: Array<[string, string]> = [
      ['Dimensions', `${i.width} x ${i.height} px`],
      ['Format', i.format],
      ['Colour', `${i.mode}${i.bit_depth ? `, ${i.bit_depth}-bit` : ''}${i.has_alpha ? ', alpha' : ''}`],
      ['Profile', i.icc ?? 'None (shown as sRGB)'],
    ];
    if (i.frames > 1) rows.push(['Frames', `${i.frames}${i.animated ? ', animated' : ''}`]);
    if (i.gps) rows.push(['Location', `${i.gps.lat.toFixed(5)}, ${i.gps.lon.toFixed(5)}`]);
    for (const [k, v] of Object.entries(i.exif)) rows.push([k, String(v)]);
    return rows;
  }

  private rows(list: Array<[string, string]>): void {
    const update = (node: HTMLElement, r: [string, string]): void => { setText(q(node, 'dd'), r[1]); };
    patchList(this.infoRows, list, {
      key: (r) => r[0],
      create: (r) => { const n = el<HTMLElement>(`<div class="ft-info-row"><dt>${escapeHtml(r[0])}</dt><dd></dd></div>`); update(n, r); return n; },
      update,
    });
  }

  private drawHist(pane: Pane | null): void {
    const ctx = this.hist.getContext('2d');
    if (!ctx) return;
    const W = this.hist.width, H = this.hist.height;
    if (!pane || !pane.w) { ctx.clearRect(0, 0, W, H); return; }
    const s = Math.min(1, 256 / Math.max(pane.w, pane.h));
    const cw = Math.max(1, Math.round(pane.w * s)), ch = Math.max(1, Math.round(pane.h * s));
    const off = new OffscreenCanvas(cw, ch);
    const o = off.getContext('2d', { willReadFrequently: true });
    if (!o) return;
    try { o.drawImage(pane.probe ?? pane.img, 0, 0, cw, ch); } catch { return; }
    const d = o.getImageData(0, 0, cw, ch).data;
    const bins = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    for (let i = 0; i < d.length; i += 4) { bins[0][d[i]]++; bins[1][d[i + 1]]++; bins[2][d[i + 2]]++; }
    let max = 1;
    for (const b of bins) for (let i = 1; i < 255; i++) if (b[i] > max) max = b[i];
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const colours = ['rgba(255,80,80,0.75)', 'rgba(80,220,120,0.75)', 'rgba(90,140,255,0.75)'];
    bins.forEach((b, c) => {
      ctx.fillStyle = colours[c];
      for (let i = 0; i < 256; i++) { const h = Math.min(H, (b[i] / max) * H); ctx.fillRect(i * (W / 256), H - h, W / 256, h); }
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  private key(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey) return;
    const map: Record<string, () => void> = {
      ArrowRight: () => this.step(1), ArrowLeft: () => this.step(-1), PageDown: () => this.step(1), PageUp: () => this.step(-1),
      Home: () => void this.show(0), End: () => void this.show(this.entries.length - 1),
      Escape: () => { if (document.fullscreenElement) void document.exitFullscreen(); else this.close(); },
      ' ': () => { if (this.quick) this.close(); else this.step(1); },
      f: () => this.act('fit'), '1': () => this.act('actual'), '+': () => this.act('zoom-in'), '=': () => this.act('zoom-in'), '-': () => this.act('zoom-out'),
      l: () => this.act('lock'), c: () => this.act('compare'), s: () => this.act('slides'), i: () => this.act('info'), F11: () => this.act('full'),
    };
    const fn = map[e.key];
    if (!fn) return;
    if (this.kind() !== 'image' && (e.key === ' ' && !this.quick)) return;
    e.preventDefault();
    fn();
  }

  close(): void {
    window.clearTimeout(this.slideTimer);
    this.slideTimer = 0;
    setClass(q(this.root, '[data-act="slides"]'), 'is-on', false);
    if (!this.video.paused) this.video.pause();
    if (!this.audio.paused) this.audio.pause();
    this.deps.close(this.current?.path ?? null);
  }

  focus(): void { this.stage.focus({ preventScroll: true }); }
}
