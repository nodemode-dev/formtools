import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { Entry } from '../../io/api';
import { docApi } from '../../io/doc-api';
import { el, q, setClass, setHidden, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { Seq, busy, errText, fmtInt, typeOnly } from './common';
import type { DocDeps, DocKind } from './types';

type Pdfjs = typeof import('pdfjs-dist');

const CSS_PER_PT = 96 / 72;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const THUMB_W = 96;
const PAD = 16;
const ASSET_BASE = '/pdfjs/';

let lib: Promise<Pdfjs> | null = null;

function pdfjs(): Promise<Pdfjs> {
  if (!lib) {
    lib = Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([m, w]) => {
      m.GlobalWorkerOptions.workerSrc = w.default;
      return m;
    });
  }
  return lib;
}

interface Size { w: number; h: number }
type FitMode = 'width' | 'page' | 'custom';

export class PdfView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-pdf" hidden>
      <div class="dv-bar">
        <button class="cv-tt-btn is-on" type="button" data-p="thumbs" title="Page thumbnails" aria-label="Page thumbnails">${icon('dvThumbs', 16)}</button>
        <span class="ft-vbar-sep"></span>
        <button class="cv-tt-btn" type="button" data-p="prev" title="Previous page (Page Up)" aria-label="Previous page">${icon('dvUp', 16)}</button>
        <input class="ft-input dv-pageno" type="text" inputmode="numeric" aria-label="Page number">
        <span class="dv-pages"></span>
        <button class="cv-tt-btn" type="button" data-p="next" title="Next page (Page Down)" aria-label="Next page">${icon('dvDown', 16)}</button>
        <span class="ft-vbar-sep"></span>
        <button class="cv-tt-btn" type="button" data-p="out" title="Zoom out (-)" aria-label="Zoom out">${icon('zoomOut', 16)}</button>
        <span class="ft-zoom dv-zoom" aria-live="polite"></span>
        <button class="cv-tt-btn" type="button" data-p="in" title="Zoom in (+)" aria-label="Zoom in">${icon('zoomIn', 16)}</button>
        <button class="cv-tt-btn" type="button" data-p="fit-width" title="Fit width (0)" aria-label="Fit width">${icon('ftFit', 16)}</button>
        <button class="cv-tt-btn" type="button" data-p="fit-page" title="Fit page (9)" aria-label="Fit page">${icon('ftScale', 16)}</button>
        <button class="cv-tt-btn" type="button" data-p="actual" title="Actual size (1)" aria-label="Actual size">${icon('ftActual', 16)}</button>
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="dv-info"></span>
        <span class="ft-busy dv-spin"></span>
      </div>
      <div class="dv-pdf-body">
        <div class="dv-pdf-thumbs"></div>
        <div class="dv-pdf-main" tabindex="0"><div class="dv-pdf-pages"></div></div>
      </div>
    </section>`);
  private readonly main = q(this.root, '.dv-pdf-main');
  private readonly pagesBox = q(this.root, '.dv-pdf-pages');
  private readonly thumbsBox = q(this.root, '.dv-pdf-thumbs');
  private readonly pageNo = q<HTMLInputElement>(this.root, '.dv-pageno');
  private readonly spin = q(this.root, '.dv-spin');
  private readonly seq = new Seq();
  private doc: PDFDocumentProxy | null = null;
  private sizes: Array<Size | undefined> = [];
  private nodes: HTMLElement[] = [];
  private thumbs: HTMLElement[] = [];
  private tasks = new Map<number, RenderTask>();
  private visible = new Set<number>();
  private thumbVisible = new Set<number>();
  private inflight = 0;
  private thumbBusy = false;
  private zoom = 1;
  private fit: FitMode = 'width';
  private current = 0;
  private scrollRaf = 0;
  private io: IntersectionObserver;
  private tio: IntersectionObserver;
  private zoomKey = '';
  private fresh = false;

  constructor(_deps: DocDeps) {
    this.io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const i = Number((en.target as HTMLElement).dataset.i);
        if (en.isIntersecting) { this.visible.add(i); void this.ensureSize(i); } else { this.visible.delete(i); this.release(i); }
      }
      this.pump();
    }, { root: this.main, rootMargin: '900px 0px' });
    this.tio = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const i = Number((en.target as HTMLElement).dataset.i);
        if (en.isIntersecting) this.thumbVisible.add(i); else this.thumbVisible.delete(i);
      }
      void this.pumpThumbs();
    }, { root: this.thumbsBox, rootMargin: '400px 0px' });
    new ResizeObserver(() => { if (this.doc && this.fit !== 'custom') this.applyFit(); }).observe(this.main);
    this.main.addEventListener('scroll', () => {
      if (this.scrollRaf) return;
      this.scrollRaf = requestAnimationFrame(() => { this.scrollRaf = 0; this.syncCurrent(); });
    }, { passive: true });
    this.root.querySelector('.dv-bar')?.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-p]') : null;
      if (b) this.act(b.dataset.p ?? '');
    });
    this.pageNo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const n = parseInt(this.pageNo.value, 10); if (Number.isFinite(n)) this.goto(n - 1); this.main.focus(); }
      else if (e.key === 'Escape') { this.pageNo.value = String(this.current + 1); this.main.focus(); e.stopPropagation(); }
    });
    this.pageNo.addEventListener('focus', () => this.pageNo.select());
    this.thumbsBox.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-i]') : null;
      if (t) this.goto(Number(t.dataset.i));
    });
  }

  async open(entry: Entry): Promise<void> {
    const my = this.seq.next();
    setClass(this.root, 'is-loading', true);
    const stop = busy(this.spin);
    try {
      const lib = await pdfjs();
      const task = lib.getDocument({
        url: docApi.rawUrl(entry.path, entry.mtime),
        cMapUrl: `${ASSET_BASE}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
        wasmUrl: `${ASSET_BASE}wasm/`,
      });
      const doc = await task.promise;
      if (!this.seq.is(my)) { void doc.loadingTask.destroy(); return; }
      const first = await doc.getPage(1);
      if (!this.seq.is(my)) { void doc.loadingTask.destroy(); return; }
      const vp = first.getViewport({ scale: 1 });
      this.teardown();
      this.doc = doc;
      this.sizes = new Array<Size | undefined>(doc.numPages).fill(undefined);
      this.sizes[0] = { w: vp.width, h: vp.height };
      this.current = 0;
      this.buildNodes(doc.numPages);
      this.fit = 'width';
      this.applyFit();
      this.main.scrollTop = 0;
      this.thumbsBox.scrollTop = 0;
      setText(q(this.root, '.dv-pages'), `of ${fmtInt(doc.numPages)}`);
      setText(q(this.root, '.dv-info'), `${fmtInt(doc.numPages)} page${doc.numPages === 1 ? '' : 's'} · ${Math.round(vp.width)} x ${Math.round(vp.height)} pt`);
      setText(q(this.root, '.dv-note'), '');
      this.pageNo.value = '1';
      this.fresh = true;
      this.syncCurrent();
    } catch (err) {
      if (this.seq.is(my)) {
        this.teardown();
        this.buildNodes(0);
        setText(q(this.root, '.dv-pages'), '');
        setText(q(this.root, '.dv-info'), '');
        this.pageNo.value = '';
        const name = err instanceof Error ? err.name : '';
        setText(q(this.root, '.dv-note'), name === 'PasswordException' ? 'This PDF is protected with a password.' : errText(err));
      }
    } finally {
      stop();
      if (this.seq.is(my)) setClass(this.root, 'is-loading', false);
    }
  }

  shown(): void {
    if (!this.doc) return;
    this.applyFit();
    if (!this.fresh) return;
    this.fresh = false;
    this.main.scrollTop = 0;
    this.thumbsBox.scrollTop = 0;
    this.syncCurrent();
  }

  close(): void {
    this.seq.bump();
    this.teardown();
    this.pagesBox.replaceChildren();
    this.thumbsBox.replaceChildren();
    this.nodes = [];
    this.thumbs = [];
  }

  key(e: KeyboardEvent): boolean {
    if (typeOnly(e) || e.metaKey || e.ctrlKey || e.altKey) return false;
    switch (e.key) {
      case '+': case '=': this.act('in'); return true;
      case '-': this.act('out'); return true;
      case '0': this.act('fit-width'); return true;
      case '9': this.act('fit-page'); return true;
      case '1': this.act('actual'); return true;
      case 'PageDown': this.goto(this.current + 1); return true;
      case 'PageUp': this.goto(this.current - 1); return true;
      case 'Home': this.goto(0); return true;
      case 'End': this.goto(this.nodes.length - 1); return true;
      default: return false;
    }
  }

  private teardown(): void {
    for (const t of this.tasks.values()) t.cancel();
    this.tasks.clear();
    this.visible.clear();
    this.thumbVisible.clear();
    this.inflight = 0;
    const old = this.doc;
    this.doc = null;
    if (old) void old.loadingTask.destroy();
  }

  private act(a: string): void {
    if (a === 'thumbs') { const on = this.thumbsBox.hidden !== false; setHidden(this.thumbsBox, !on); setClass(q(this.root, '[data-p="thumbs"]'), 'is-on', on); }
    else if (a === 'prev') this.goto(this.current - 1);
    else if (a === 'next') this.goto(this.current + 1);
    else if (a === 'in') this.setZoom(this.zoom * 1.2, 'custom');
    else if (a === 'out') this.setZoom(this.zoom / 1.2, 'custom');
    else if (a === 'fit-width') { this.fit = 'width'; this.applyFit(); }
    else if (a === 'fit-page') { this.fit = 'page'; this.applyFit(); }
    else if (a === 'actual') this.setZoom(1, 'custom');
  }

  private sizeOf(i: number): Size { return this.sizes[i] ?? this.sizes[0] ?? { w: 612, h: 792 }; }
  private cssScale(): number { return this.zoom * CSS_PER_PT; }

  private applyFit(): void {
    if (!this.doc || this.main.clientWidth === 0) return;
    const s = this.sizeOf(this.current);
    const availW = Math.max(100, this.main.clientWidth - PAD * 2 - 4);
    const availH = Math.max(100, this.main.clientHeight - PAD * 2);
    let z = this.zoom;
    if (this.fit === 'width') z = availW / s.w / CSS_PER_PT;
    else if (this.fit === 'page') z = Math.min(availW / s.w, availH / s.h) / CSS_PER_PT;
    this.setZoom(z, this.fit);
  }

  private setZoom(z: number, mode: FitMode): void {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    this.fit = mode;
    if (Math.abs(next - this.zoom) < 0.0005 && this.zoomKey) { this.updateLabel(); return; }
    const anchor = this.nodes[this.current];
    const ratio = anchor && anchor.offsetHeight ? (this.main.scrollTop - anchor.offsetTop) / anchor.offsetHeight : 0;
    this.zoom = next;
    this.zoomKey = next.toFixed(4);
    for (let i = 0; i < this.nodes.length; i++) this.sizeNode(i);
    if (anchor) this.main.scrollTop = anchor.offsetTop + ratio * anchor.offsetHeight;
    this.updateLabel();
    this.pump();
  }

  private updateLabel(): void {
    setText(q(this.root, '.dv-zoom'), `${Math.round(this.zoom * 100)}%`);
  }

  private sizeNode(i: number): void {
    const node = this.nodes[i];
    if (!node) return;
    const s = this.sizeOf(i), c = this.cssScale();
    const w = `${Math.round(s.w * c)}px`, h = `${Math.round(s.h * c)}px`;
    if (node.style.width !== w) node.style.width = w;
    if (node.style.height !== h) node.style.height = h;
  }

  private buildNodes(n: number): void {
    this.io.disconnect();
    this.tio.disconnect();
    while (this.nodes.length > n) { this.nodes.pop(); this.pagesBox.lastElementChild?.remove(); }
    while (this.nodes.length < n) {
      const i = this.nodes.length;
      const node = document.createElement('div');
      node.className = 'dv-pdf-page';
      node.dataset.i = String(i);
      this.pagesBox.appendChild(node);
      this.nodes.push(node);
    }
    for (const node of this.nodes) { node.dataset.rz = ''; node.replaceChildren(); }
    this.visible.clear();
    while (this.thumbs.length > n) { this.thumbs.pop(); this.thumbsBox.lastElementChild?.remove(); }
    while (this.thumbs.length < n) {
      const i = this.thumbs.length;
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'dv-pdf-thumb';
      t.dataset.i = String(i);
      t.innerHTML = '<span class="dv-pdf-thumb-box"></span><span class="dv-pdf-thumb-n"></span>';
      setText(t.children[1], String(i + 1));
      t.setAttribute('aria-label', `Page ${i + 1}`);
      this.thumbsBox.appendChild(t);
      this.thumbs.push(t);
    }
    for (const t of this.thumbs) { t.dataset.rz = ''; (t.firstElementChild as HTMLElement).replaceChildren(); }
    this.thumbVisible.clear();
    this.zoomKey = '';
    this.sizeThumbs();
    for (const node of this.nodes) this.io.observe(node);
    for (const th of this.thumbs) this.tio.observe(th);
  }

  private sizeThumbs(): void {
    for (let i = 0; i < this.thumbs.length; i++) {
      const s = this.sizeOf(i);
      const box = this.thumbs[i].firstElementChild as HTMLElement;
      const h = `${Math.round((THUMB_W * s.h) / s.w)}px`;
      if (box.style.height !== h) box.style.height = h;
    }
  }

  private async ensureSize(i: number): Promise<void> {
    const doc = this.doc;
    if (!doc || this.sizes[i]) return;
    try {
      const page = await doc.getPage(i + 1);
      if (this.doc !== doc) return;
      const v = page.getViewport({ scale: 1 });
      this.sizes[i] = { w: v.width, h: v.height };
      this.sizeNode(i);
      const box = this.thumbs[i]?.firstElementChild as HTMLElement | undefined;
      if (box) box.style.height = `${Math.round((THUMB_W * v.height) / v.width)}px`;
    } catch {
      return;
    }
  }

  private release(i: number): void {
    const t = this.tasks.get(i);
    if (t) { t.cancel(); this.tasks.delete(i); }
    const node = this.nodes[i];
    if (node && node.dataset.rz) {
      node.dataset.rz = '';
      const c = node.firstElementChild as HTMLCanvasElement | null;
      if (c) { c.width = 0; c.height = 0; }
      node.replaceChildren();
    }
  }

  private pump(): void {
    if (!this.doc) return;
    const order = [...this.visible].filter((i) => this.nodes[i] && this.nodes[i].dataset.rz !== this.zoomKey && !this.tasks.has(i)).sort((a, b) => Math.abs(a - this.current) - Math.abs(b - this.current));
    for (const i of order) {
      if (this.inflight >= 2) break;
      void this.render(i);
    }
  }

  private async render(i: number): Promise<void> {
    const doc = this.doc;
    const node = this.nodes[i];
    if (!doc || !node) return;
    const key = this.zoomKey;
    this.inflight++;
    let task: RenderTask | null = null;
    try {
      const page = await doc.getPage(i + 1);
      if (this.doc !== doc || !this.visible.has(i)) return;
      const base = page.getViewport({ scale: 1 });
      if (!this.sizes[i] || this.sizes[i]?.w !== base.width) { this.sizes[i] = { w: base.width, h: base.height }; this.sizeNode(i); }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = this.cssScale();
      const vp = page.getViewport({ scale: c * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.className = 'dv-pdf-canvas';
      task = page.render({ canvas, viewport: vp });
      this.tasks.set(i, task);
      await task.promise;
      if (this.doc !== doc || key !== this.zoomKey) return;
      node.replaceChildren(canvas);
      node.dataset.rz = key;
    } catch {
      return;
    } finally {
      if (this.doc === doc) this.inflight--;
      if (task && this.tasks.get(i) === task) this.tasks.delete(i);
      this.pump();
    }
  }

  private async pumpThumbs(): Promise<void> {
    if (this.thumbBusy || !this.doc) return;
    this.thumbBusy = true;
    const doc = this.doc;
    try {
      for (;;) {
        const next = [...this.thumbVisible].filter((i) => this.thumbs[i] && !this.thumbs[i].dataset.rz).sort((a, b) => a - b)[0];
        if (next === undefined || this.doc !== doc) break;
        const t = this.thumbs[next];
        t.dataset.rz = '1';
        const page = await doc.getPage(next + 1);
        if (this.doc !== doc) break;
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: (THUMB_W * dpr) / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.className = 'dv-pdf-canvas';
        await page.render({ canvas, viewport: vp }).promise;
        if (this.doc !== doc) break;
        (t.firstElementChild as HTMLElement).replaceChildren(canvas);
      }
    } catch {
      return;
    } finally {
      this.thumbBusy = false;
      if (this.doc && this.doc !== doc) void this.pumpThumbs();
    }
  }

  private goto(i: number): void {
    const n = this.nodes.length;
    if (!n) return;
    const idx = Math.max(0, Math.min(n - 1, i));
    this.main.scrollTop = this.nodes[idx].offsetTop - PAD;
    this.current = idx;
    this.syncUi();
  }

  private syncCurrent(): void {
    if (!this.nodes.length) return;
    const probe = this.main.scrollTop + this.main.clientHeight * 0.35;
    let lo = 0, hi = this.nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.nodes[mid].offsetTop <= probe) lo = mid; else hi = mid - 1;
    }
    if (lo !== this.current) { this.current = lo; this.pump(); }
    this.syncUi();
  }

  private syncUi(): void {
    if (document.activeElement !== this.pageNo) this.pageNo.value = String(this.current + 1);
    this.thumbs.forEach((t, i) => setClass(t, 'is-on', i === this.current));
    const t = this.thumbs[this.current];
    if (t && !this.thumbsBox.hidden) {
      const top = t.offsetTop, bottom = top + t.offsetHeight;
      if (top < this.thumbsBox.scrollTop) this.thumbsBox.scrollTop = top - 8;
      else if (bottom > this.thumbsBox.scrollTop + this.thumbsBox.clientHeight) this.thumbsBox.scrollTop = bottom - this.thumbsBox.clientHeight + 8;
    }
  }
}
