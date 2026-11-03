import { api, type Entry, type ImageInfo, type Label, type MediaInfo, type Tag, type TransformOp } from '../io/api';
import { delayedIndicator, el, escapeHtml, patchList, q, setClass, setHidden, setText, type Disposer } from './dom';
import { icon } from './icons';
import { loadPrefs, onPrefs } from './prefs';
import { toast } from './toast';
import { LABEL_KEYS } from './browser';
import { CropOverlay, type Rect } from './crop';
import { PixelInspector } from './inspector';
import { MediaBar } from './media-bar';
import { SaveDialog } from './save-dialog';
import type { Jobs } from './jobs';

export interface ViewerDeps {
  close: (path: string | null) => void;
  status: (text: string) => void;
  title: (name: string) => void;
  openIn: (entry: Entry) => void;
  reveal: (path: string) => void;
  tagOf: (path: string) => Tag | undefined;
  tagged: (path: string, tag: Tag) => void;
  saved: (path: string) => void;
  jobs: Jobs;
  saveDialog: SaveDialog;
}

const LABELS: Label[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'grey'];

const fmtDuration = (s: number | null): string => {
  if (s === null || !Number.isFinite(s)) return 'unknown';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
const fmtRate = (b: number | null | undefined): string => (b ? `${(b / 1000).toFixed(0)} kbit/s` : '');

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
  if (e.type === 'video') return 'video';
  if (e.type === 'audio') return 'audio';
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
  private readonly mbar: MediaBar;
  private readonly crop: CropOverlay;
  private readonly pixel = new PixelInspector();
  private readonly tagBox: HTMLElement;
  private mediaInfo: MediaInfo | null = null;
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
          <button class="cv-tt-btn" type="button" data-act="actual" title="Actual pixels (A)" aria-label="Actual pixels">${icon('ftActual', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="zoom-out" title="Zoom out (-)" aria-label="Zoom out">${icon('zoomOut', 16)}</button>
          <span class="ft-zoom" aria-live="polite"></span>
          <button class="cv-tt-btn" type="button" data-act="zoom-in" title="Zoom in (+)" aria-label="Zoom in">${icon('zoomIn', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="lock" title="Keep zoom between images (L)" aria-label="Lock zoom">${icon('lock', 16)}</button>
          <span class="ft-vbar-sep"></span>
          <button class="cv-tt-btn" type="button" data-act="rotate-ccw" title="Rotate left, saved losslessly where possible" aria-label="Rotate left">${icon('undo', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="rotate-cw" title="Rotate right, saved losslessly where possible" aria-label="Rotate right">${icon('rotate', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="flip-h" title="Flip horizontally" aria-label="Flip horizontally">${icon('flipH', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="flip-v" title="Flip vertically" aria-label="Flip vertically">${icon('flipV', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="crop" title="Crop (R)" aria-label="Crop">${icon('ftCrop', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="resize" title="Resize (Shift+R)" aria-label="Resize">${icon('ftScale', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="save-as" title="Save as another format" aria-label="Save as">${icon('ftSave', 16)}</button>
          <button class="cv-tt-btn" type="button" data-act="pixel" title="Pixel inspector (P); click copies the colour" aria-label="Pixel inspector">${icon('ftPixel', 16)}</button>
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
            <div class="ft-audio-box" hidden><span class="ft-audio-icon">${icon('ftAudio', 48)}</span><span class="ft-wave-slot"></span><audio class="ft-audio" controls preload="metadata"></audio></div>
            <p class="ft-vmsg" hidden></p>
          </div>
          <aside class="ft-info" hidden>
            <div class="ft-info-title">Information</div>
            <div class="ft-tagbox">
              <div class="ft-stars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button class="ft-star" type="button" data-rate="${n}" title="${n} star${n === 1 ? '' : 's'} (${n})" aria-label="${n} stars">${icon('ftStarFill', 16)}</button>`).join('')}</div>
              <div class="ft-labels" role="radiogroup" aria-label="Colour label">${LABELS.map((l) => `<button class="ft-label-dot" type="button" data-label="${l}" data-set-label="${l}" title="${l}" aria-label="${l} label"></button>`).join('')}</div>
            </div>
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
    this.tagBox = q(this.root, '.ft-tagbox');
    this.mbar = new MediaBar(deps.jobs, () => { const c = this.current; if (c) deps.saved(c.path); });
    q(this.root, '.ft-vbar').after(this.mbar.root);
    q(this.root, '.ft-wave-slot').replaceWith(this.mbar.wave);
    this.crop = new CropOverlay({
      toImage: (sx, sy) => this.toImage(sx, sy),
      toScreen: (ix, iy) => this.toScreen(ix, iy),
      size: () => ({ w: this.panes[0].w, h: this.panes[0].h }),
      apply: (r) => this.saveCrop(r),
      cancel: () => this.endCrop(),
    });
    this.stage.append(this.crop.root, this.pixel.root);
    this.tagBox.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const rate = t?.closest<HTMLElement>('[data-rate]')?.dataset.rate;
      const label = t?.closest<HTMLElement>('[data-set-label]')?.dataset.setLabel as Label | undefined;
      const cur = this.current ? this.deps.tagOf(this.current.path) : undefined;
      if (rate) void this.tag({ rating: cur?.rating === Number(rate) ? 0 : Number(rate) });
      else if (label) void this.tag({ label: cur?.label === label ? null : label });
    });
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
      if (e.button !== 0 || this.kind() !== 'image' || this.crop.active) return;
      this.stage.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
      setClass(this.stage, 'is-dragging', true);
    });
    this.stage.addEventListener('pointerleave', () => this.pixel.hide());
    this.stage.addEventListener('click', (e) => {
      if (this.pixel.on && this.drag === null && Math.abs(e.movementX) < 2) this.pixel.copy();
    });
    this.stage.addEventListener('pointermove', (e) => {
      if (this.pixel.on && !this.drag && this.kind() === 'image' && !this.crop.active) {
        const p = this.toImage(e.clientX, e.clientY);
        const r = this.stage.getBoundingClientRect();
        this.pixel.show(p.x, p.y, e.clientX, e.clientY, r.left, r.top);
      }
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

  private paneRect(): DOMRect { return this.panes[0].box.getBoundingClientRect(); }

  private toImage(sx: number, sy: number): { x: number; y: number } {
    const r = this.paneRect(), p = this.panes[0], { zoom, x, y } = this.view;
    return { x: (sx - r.left - r.width / 2 - x) / zoom + p.w / 2, y: (sy - r.top - r.height / 2 - y) / zoom + p.h / 2 };
  }

  private toScreen(ix: number, iy: number): { x: number; y: number } {
    const r = this.paneRect(), p = this.panes[0], { zoom, x, y } = this.view;
    return { x: r.left + r.width / 2 + x + (ix - p.w / 2) * zoom, y: r.top + r.height / 2 + y + (iy - p.h / 2) * zoom };
  }

  private syncTag(e: Entry | null): void {
    const show = !!e && (e.type === 'image' || e.type === 'family' || e.type === 'video');
    setHidden(this.tagBox, !show);
    if (!show || !e) return;
    const known = this.deps.tagOf(e.path);
    if (!known) void api.metaRead([e.path]).then((r) => { const t = r.items[e.path]; if (t) { this.deps.tagged(e.path, t); if (this.current?.path === e.path) this.syncTag(e); } }).catch(() => undefined);
    const t = known ?? { rating: 0, label: null };
    for (const b of this.tagBox.querySelectorAll<HTMLElement>('[data-rate]')) setClass(b, 'is-on', Number(b.dataset.rate) <= t.rating);
    for (const b of this.tagBox.querySelectorAll<HTMLElement>('[data-set-label]')) setClass(b, 'is-on', b.dataset.setLabel === t.label);
  }

  private async tag(change: Partial<Tag>): Promise<void> {
    const e = this.current;
    if (!e || !(e.type === 'image' || e.type === 'family' || e.type === 'video')) return;
    try {
      const t = await api.metaWrite(e.path, change);
      this.deps.tagged(e.path, t);
      this.syncTag(e);
      toast(change.rating !== undefined ? (t.rating ? `${t.rating} star${t.rating === 1 ? '' : 's'}.` : 'Rating cleared.') : (t.label ? `Label ${t.label}.` : 'Label cleared.'), 'info', 1400);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The tag was not saved.', 'error');
    }
  }

  private startCrop(): void {
    if (this.kind() !== 'image' || !this.panes[0].w || this.current?.type !== 'image') return;
    if (this.compare) this.toggleCompare();
    this.setMode('fit');
    this.crop.start();
    setClass(q(this.root, '[data-act="crop"]'), 'is-on', true);
  }

  private endCrop(): void {
    this.crop.stop();
    setClass(q(this.root, '[data-act="crop"]'), 'is-on', false);
    this.stage.focus({ preventScroll: true });
  }

  private saveCrop(r: Rect): void {
    const e = this.current;
    if (!e) return;
    this.endCrop();
    this.deps.saveDialog.open('crop', e, { w: r.w, h: r.h }, [{ op: 'crop', x: r.x, y: r.y, w: r.w, h: r.h }], (p) => this.deps.saved(p));
  }

  private openSave(mode: 'resize' | 'save'): void {
    const e = this.current, p = this.panes[0];
    if (!e || e.type !== 'image' || !p.w) return;
    this.deps.saveDialog.open(mode, e, { w: p.w, h: p.h }, [], (path) => this.deps.saved(path));
  }

  private async showMedia(e: Entry, k: 'video' | 'audio', seq: number): Promise<void> {
    const m = k === 'video' ? this.video : this.audio;
    this.mbar.attach(m, e);
    this.mediaInfo = null;
    const native = (k === 'video' ? NATIVE_VIDEO : NATIVE_AUDIO).has(e.ext);
    const raw = api.rawUrl(e.path, e.mtime);
    if (native) { if (m.getAttribute('src') !== raw) m.src = raw; }
    else { m.removeAttribute('src'); m.load(); }
    setHidden(this.message, true);
    this.deps.status(`${e.name} · ${e.ext.toUpperCase()}`);
    if (k === 'video') { this.video.poster = api.mediaThumbUrl(e.path, 1280, e.mtime); void this.mbar.loadSubtitles(e.path); }
    else void this.mbar.loadWave(e.path);
    this.syncInfo(e, null);
    try {
      const info = await api.mediaInfo(e.path);
      if (seq !== this.seq) return;
      this.mediaInfo = info;
      this.mbar.setInfo(info);
      this.syncInfo(e, null);
      const v = info.streams.find((s) => s.type === 'video'), a = info.streams.find((s) => s.type === 'audio');
      this.deps.status(`${e.name} · ${fmtDuration(info.format.duration)}${v ? ` · ${v.width} x ${v.height} ${v.codec}` : ''}${a ? ` · ${a.codec}` : ''}`);
      if (!info.playable.native && info.playable.remux) {
        const stream = api.streamUrl(e.path, e.mtime);
        if (m.getAttribute('src') !== stream) m.src = stream;
        this.mbar.note('Played through a lossless remux; seeking is limited.');
      } else if (!info.playable.native && !native) {
        setText(this.message, `This ${k} uses ${[v?.codec, a?.codec].filter(Boolean).join(' and ')}, which this system cannot play. Convert it with formencoder, or open it in its app.`);
        setHidden(this.message, false);
      }
    } catch (err) {
      if (seq !== this.seq) return;
      if (!native) {
        setText(this.message, err instanceof Error && /ffmpeg|ffprobe/i.test(err.message) ? 'formtools needs FFmpeg for this file; it is being fetched in the background. Try again in a moment.' : `formtools cannot play .${e.ext} files on this system.`);
        setHidden(this.message, false);
      }
    }
  }

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
    if (this.crop.active) this.endCrop();
    this.setMedia(k);
    this.syncTag(e);
    if (k === 'video' || k === 'audio') {
      void this.showMedia(e, k, seq);
      return;
    }
    this.mbar.detach();
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
      this.pixel.setSource(this.panes[0].probe);
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
    this.crop.paint();
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
      case 'crop': if (this.crop.active) this.endCrop(); else this.startCrop(); break;
      case 'resize': this.openSave('resize'); break;
      case 'save-as': this.openSave('save'); break;
      case 'pixel': { const on = this.pixel.toggle(); setClass(q(this.root, '[data-act="pixel"]'), 'is-on', on); setClass(this.stage, 'is-inspecting', on); break; }
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
    setHidden(this.hist, e.type === 'video' || e.type === 'audio');
    if ((e.type === 'video' || e.type === 'audio') && this.mediaInfo) { this.rows([...base, ...this.mediaRowsOf(this.mediaInfo)]); return; }
    this.rows(base);
    this.drawHist(pane);
    if (e.type !== 'image' && e.type !== 'family') return;
    void api.info(e.path).then((info) => { if (seq === this.infoSeq) this.rows([...base, ...this.infoRowsOf(info)]); }).catch(() => undefined);
  }

  private mediaRowsOf(m: MediaInfo): Array<[string, string]> {
    const rows: Array<[string, string]> = [
      ['Container', m.format.long_name || m.format.name],
      ['Duration', fmtDuration(m.format.duration)],
    ];
    if (m.format.bit_rate) rows.push(['Bit rate', fmtRate(m.format.bit_rate)]);
    for (const s of m.streams) {
      const lang = s.language ? ` (${s.language})` : '';
      let text = '';
      if (s.type === 'video') text = `${s.codec}${s.profile ? ` ${s.profile}` : ''}, ${s.width} x ${s.height}${s.fps ? `, ${Number(s.fps.toFixed(3))} fps` : ''}${s.pix_fmt ? `, ${s.pix_fmt}` : ''}${s.hdr?.transfer ? `, HDR ${s.hdr.transfer}` : ''}`;
      else if (s.type === 'audio') text = `${s.codec}, ${s.channels ?? '?'} ch${s.layout ? ` ${s.layout}` : ''}, ${s.sample_rate ?? '?'} Hz${s.bit_rate ? `, ${fmtRate(s.bit_rate)}` : ''}`;
      else text = `${s.codec}${s.title ? `, ${s.title}` : ''}`;
      rows.push([`${s.type[0].toUpperCase()}${s.type.slice(1)} ${s.index}${lang}`, text]);
    }
    if (m.chapters.length) rows.push(['Chapters', m.chapters.map((c) => `${fmtDuration(c.start)} ${c.title}`).join(' · ')]);
    for (const [k, v] of Object.entries(m.format.tags).slice(0, 12)) rows.push([k, v]);
    return rows;
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
    const x = i.xmp ?? {};
    if (x.title) rows.push(['Title', String(x.title)]);
    if (x.description) rows.push(['Description', String(x.description)]);
    if (x.creator) rows.push(['Creator', String(x.creator)]);
    if (x.rights) rows.push(['Rights', String(x.rights)]);
    if (Array.isArray(x.keywords) && x.keywords.length) rows.push(['Keywords', x.keywords.join(', ')]);
    for (const [k, v] of Object.entries(i.iptc ?? {})) rows.push([`IPTC ${k}`, Array.isArray(v) ? v.join(', ') : String(v)]);
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
    if (this.crop.key(e)) { e.preventDefault(); return; }
    const k = this.kind();
    if ((k === 'video' || k === 'audio') && !(e.key === ' ' && this.quick) && this.mbar.key(e)) { e.preventDefault(); return; }
    if (/^[0-5]$/.test(e.key)) { e.preventDefault(); void this.tag({ rating: Number(e.key) }); return; }
    if (LABEL_KEYS[e.key]) {
      e.preventDefault();
      const cur = this.current ? this.deps.tagOf(this.current.path)?.label : null;
      void this.tag({ label: cur === LABEL_KEYS[e.key] ? null : LABEL_KEYS[e.key] });
      return;
    }
    const map: Record<string, () => void> = {
      ArrowRight: () => this.step(1), ArrowLeft: () => this.step(-1), PageDown: () => this.step(1), PageUp: () => this.step(-1),
      Home: () => void this.show(0), End: () => void this.show(this.entries.length - 1),
      Escape: () => { if (document.fullscreenElement) void document.exitFullscreen(); else this.close(); },
      ' ': () => { if (this.quick) this.close(); else this.step(1); },
      f: () => this.act('fit'), a: () => this.act('actual'), '+': () => this.act('zoom-in'), '=': () => this.act('zoom-in'), '-': () => this.act('zoom-out'),
      l: () => this.act('lock'), c: () => this.act('compare'), s: () => this.act('slides'), i: () => this.act('info'), F11: () => this.act('full'),
      r: () => this.act('crop'), R: () => this.act('resize'), p: () => this.act('pixel'),
    };
    const fn = map[e.key];
    if (!fn) return;
    if (k !== 'image' && (e.key === ' ' && !this.quick)) return;
    e.preventDefault();
    fn();
  }

  close(): void {
    window.clearTimeout(this.slideTimer);
    this.slideTimer = 0;
    setClass(q(this.root, '[data-act="slides"]'), 'is-on', false);
    if (!this.video.paused) this.video.pause();
    if (!this.audio.paused) this.audio.pause();
    if (this.crop.active) this.endCrop();
    this.pixel.hide();
    this.deps.close(this.current?.path ?? null);
  }

  refreshTag(): void { this.syncTag(this.current); }

  focus(): void { this.stage.focus({ preventScroll: true }); }
}
