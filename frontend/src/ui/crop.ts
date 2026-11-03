import { el, q, setHidden, setStyleVar, setText, setValue } from './dom';
import { icon } from './icons';

export interface Rect { x: number; y: number; w: number; h: number }

export interface CropDeps {
  toImage: (sx: number, sy: number) => { x: number; y: number };
  toScreen: (ix: number, iy: number) => { x: number; y: number };
  size: () => { w: number; h: number };
  apply: (r: Rect) => void;
  cancel: () => void;
}

const RATIOS: Array<[string, string]> = [['free', 'Free'], ['original', 'Original'], ['1', '1:1'], ['1.3333', '4:3'], ['1.5', '3:2'], ['1.7778', '16:9'], ['0.8', '4:5'], ['0.5625', '9:16']];

export class CropOverlay {
  readonly root = el<HTMLElement>(`<div class="ft-crop" hidden>
      <div class="ft-crop-box"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div>
      <div class="ft-crop-bar">
        <label class="ft-m-field">Aspect <select class="cv-hf-sort ft-crop-ratio">${RATIOS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
        <span class="ft-crop-size"></span>
        <button class="ft-btn" type="button" data-c="cancel">Cancel</button>
        <button class="ft-btn is-primary" type="button" data-c="apply">${icon('ftCrop', 14)} Crop</button>
      </div></div>`);
  private readonly box = q(this.root, '.ft-crop-box');
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private drag: { mode: string; sx: number; sy: number; start: Rect } | null = null;

  constructor(private readonly deps: CropDeps) {
    this.root.addEventListener('pointerdown', (e) => this.down(e));
    this.root.addEventListener('pointermove', (e) => this.move(e));
    this.root.addEventListener('pointerup', () => { this.drag = null; });
    this.root.addEventListener('click', (e) => {
      const c = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-c]') : null)?.dataset.c;
      if (c === 'apply') this.apply();
      else if (c === 'cancel') this.deps.cancel();
    });
    q<HTMLSelectElement>(this.root, '.ft-crop-ratio').addEventListener('change', () => { this.constrain('se'); this.paint(); });
  }

  get active(): boolean { return !this.root.hidden; }

  start(): void {
    const { w, h } = this.deps.size();
    const m = Math.round(Math.min(w, h) * 0.1);
    this.rect = { x: m, y: m, w: w - 2 * m, h: h - 2 * m };
    setValue(q(this.root, '.ft-crop-ratio'), 'free');
    setHidden(this.root, false);
    this.paint();
  }

  stop(): void { setHidden(this.root, true); this.drag = null; }

  paint(): void {
    if (this.root.hidden) return;
    const a = this.deps.toScreen(this.rect.x, this.rect.y);
    const b = this.deps.toScreen(this.rect.x + this.rect.w, this.rect.y + this.rect.h);
    const host = this.root.getBoundingClientRect();
    setStyleVar(this.box, '--x', `${Math.round(a.x - host.left)}px`);
    setStyleVar(this.box, '--y', `${Math.round(a.y - host.top)}px`);
    setStyleVar(this.box, '--w', `${Math.round(b.x - a.x)}px`);
    setStyleVar(this.box, '--h', `${Math.round(b.y - a.y)}px`);
    setText(q(this.root, '.ft-crop-size'), `${Math.round(this.rect.w)} x ${Math.round(this.rect.h)} px`);
  }

  private ratio(): number | null {
    const v = q<HTMLSelectElement>(this.root, '.ft-crop-ratio').value;
    if (v === 'free') return null;
    if (v === 'original') { const s = this.deps.size(); return s.w / s.h; }
    return Number(v);
  }

  private down(e: PointerEvent): void {
    const t = e.target instanceof Element ? e.target : null;
    if (!t || t.closest('.ft-crop-bar') || e.button !== 0) return;
    e.preventDefault();
    this.root.setPointerCapture(e.pointerId);
    const handle = t.closest<HTMLElement>('[data-h]')?.dataset.h;
    const p = this.deps.toImage(e.clientX, e.clientY);
    if (handle) this.drag = { mode: handle, sx: p.x, sy: p.y, start: { ...this.rect } };
    else if (t.closest('.ft-crop-box')) this.drag = { mode: 'move', sx: p.x, sy: p.y, start: { ...this.rect } };
    else { this.rect = { x: p.x, y: p.y, w: 1, h: 1 }; this.drag = { mode: 'se', sx: p.x, sy: p.y, start: { ...this.rect } }; }
  }

  private move(e: PointerEvent): void {
    if (!this.drag) return;
    const p = this.deps.toImage(e.clientX, e.clientY);
    const dx = p.x - this.drag.sx, dy = p.y - this.drag.sy, s = this.drag.start;
    const { w: W, h: H } = this.deps.size();
    let r: Rect;
    if (this.drag.mode === 'move') r = { x: Math.max(0, Math.min(W - s.w, s.x + dx)), y: Math.max(0, Math.min(H - s.h, s.y + dy)), w: s.w, h: s.h };
    else {
      let x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h;
      if (this.drag.mode.includes('w')) x1 += dx; else x2 += dx;
      if (this.drag.mode.includes('n')) y1 += dy; else y2 += dy;
      r = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
    }
    this.rect = r;
    this.constrain(this.drag.mode);
    this.paint();
  }

  private constrain(mode: string): void {
    const { w: W, h: H } = this.deps.size();
    const ratio = this.ratio();
    let { x, y, w, h } = this.rect;
    x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(H - 1, y));
    w = Math.max(1, Math.min(W - x, w)); h = Math.max(1, Math.min(H - y, h));
    if (ratio && mode !== 'move') {
      if (w / h > ratio) w = h * ratio; else h = w / ratio;
      if (x + w > W) { w = W - x; h = w / ratio; }
      if (y + h > H) { h = H - y; w = h * ratio; }
    }
    this.rect = { x, y, w, h };
  }

  key(e: KeyboardEvent): boolean {
    if (this.root.hidden) return false;
    if (e.key === 'Enter') { this.apply(); return true; }
    if (e.key === 'Escape') { this.deps.cancel(); return true; }
    return false;
  }

  private apply(): void {
    const r = { x: Math.round(this.rect.x), y: Math.round(this.rect.y), w: Math.max(1, Math.round(this.rect.w)), h: Math.max(1, Math.round(this.rect.h)) };
    this.deps.apply(r);
  }
}
