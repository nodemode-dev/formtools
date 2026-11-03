import { el, setHidden, setStyleVar, setText } from './dom';
import { toast } from './toast';

const LIMIT = 40_000_000;

export class PixelInspector {
  readonly root = el<HTMLElement>('<div class="ft-pixel" hidden><i class="ft-pixel-swatch"></i><span class="ft-pixel-text"></span></div>');
  private data: ImageData | null = null;
  private scale = 1;
  private source: HTMLImageElement | null = null;
  private last = '';
  on = false;

  setSource(img: HTMLImageElement | null): void {
    if (img === this.source) return;
    this.source = img;
    this.data = null;
  }

  private ensure(): ImageData | null {
    if (this.data || !this.source) return this.data;
    const w = this.source.naturalWidth, h = this.source.naturalHeight;
    if (!w || !h) return null;
    this.scale = w * h > LIMIT ? Math.sqrt(LIMIT / (w * h)) : 1;
    const cw = Math.max(1, Math.round(w * this.scale)), ch = Math.max(1, Math.round(h * this.scale));
    const c = new OffscreenCanvas(cw, ch);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    try { ctx.drawImage(this.source, 0, 0, cw, ch); this.data = ctx.getImageData(0, 0, cw, ch); } catch { this.data = null; }
    return this.data;
  }

  toggle(): boolean {
    this.on = !this.on;
    if (!this.on) setHidden(this.root, true);
    return this.on;
  }

  show(ix: number, iy: number, sx: number, sy: number, hostLeft: number, hostTop: number): void {
    if (!this.on || !this.source) return;
    const d = this.ensure();
    const w = this.source.naturalWidth, h = this.source.naturalHeight;
    const x = Math.floor(ix), y = Math.floor(iy);
    if (!d || x < 0 || y < 0 || x >= w || y >= h) { setHidden(this.root, true); return; }
    const px = Math.min(d.width - 1, Math.floor(x * this.scale)), py = Math.min(d.height - 1, Math.floor(y * this.scale));
    const i = (py * d.width + px) * 4;
    const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2], a = d.data[i + 3];
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    this.last = hex;
    setText(this.root.querySelector('.ft-pixel-text'), `${x}, ${y} · ${hex} · rgb(${r}, ${g}, ${b})${a < 255 ? ` · alpha ${a}` : ''}`);
    setStyleVar(this.root, '--swatch', hex);
    setStyleVar(this.root, '--px', `${Math.round(sx - hostLeft + 18)}px`);
    setStyleVar(this.root, '--py', `${Math.round(sy - hostTop + 18)}px`);
    setHidden(this.root, false);
  }

  hide(): void { setHidden(this.root, true); }

  copy(): void {
    if (!this.on || !this.last) return;
    void navigator.clipboard.writeText(this.last).then(() => toast(`Copied ${this.last}.`)).catch(() => undefined);
  }
}
