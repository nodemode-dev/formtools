import type { Rgb } from '../desk/color';
import { el, q } from '../ui/dom';

export interface View { z: number; tx: number; ty: number }
export interface Point { x: number; y: number }

export function frameLoop(draw: () => void): () => void {
  let queued = 0;
  return () => {
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      draw();
    });
  };
}

export function place(node: HTMLElement, x: number, y: number): void {
  const t = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  if (node.style.transform !== t) node.style.transform = t;
}

export class Stage {
  readonly root = el<HTMLDivElement>('<div class="ov-stage"><div class="ov-world"><div class="ov-board"></div><canvas class="ov-shot"></canvas></div></div>');
  readonly world = q<HTMLDivElement>(this.root, '.ov-world');
  readonly shot = q<HTMLCanvasElement>(this.root, '.ov-shot');
  readonly board = q<HTMLDivElement>(this.root, '.ov-board');
  view: View = { z: 1, tx: 0, ty: 0 };
  width = 0;
  height = 0;
  pixels = new Uint8ClampedArray(0);
  private bitmap: ImageBitmap | null = null;
  private fallback: number;

  constructor(scaleHint: number) {
    this.fallback = scaleHint > 0 ? scaleHint : Math.max(1, window.devicePixelRatio || 1);
  }

  get sx(): number { return innerWidth > 0 && this.width > 0 ? this.width / innerWidth : this.fallback; }
  get sy(): number { return innerHeight > 0 && this.height > 0 ? this.height / innerHeight : this.fallback; }

  async load(path: string): Promise<void> {
    if (!path) throw new Error('This overlay was opened without a screenshot.');
    const res = await fetch(`/api/file/raw?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || 'The screenshot could not be loaded.');
    }
    const blob = await res.blob();
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    } catch {
      throw new Error('The screenshot is not a readable image.');
    }
    this.bitmap = bmp;
    this.width = bmp.width;
    this.height = bmp.height;
    this.shot.width = bmp.width;
    this.shot.height = bmp.height;
    const g = this.shot.getContext('2d', { alpha: false });
    if (g) g.drawImage(bmp, 0, 0);
    const off = new OffscreenCanvas(bmp.width, bmp.height);
    const og = off.getContext('2d', { willReadFrequently: true });
    if (!og) throw new Error('This system cannot read pixels from the screenshot.');
    og.drawImage(bmp, 0, 0);
    this.pixels = og.getImageData(0, 0, bmp.width, bmp.height).data;
  }

  addLayer(cls: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.className = cls;
    c.width = this.width;
    c.height = this.height;
    this.world.append(c);
    return c;
  }

  rgbAt(x: number, y: number): Rgb | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const i = (y * this.width + x) * 4;
    return { r: this.pixels[i], g: this.pixels[i + 1], b: this.pixels[i + 2] };
  }

  setView(z: number, tx: number, ty: number): void {
    this.view = { z, tx, ty };
    const t = `translate3d(${tx}px, ${ty}px, 0) scale(${z})`;
    if (this.world.style.transform !== t) this.world.style.transform = t;
  }

  toPhys(cx: number, cy: number): Point {
    const { z, tx, ty } = this.view;
    return { x: ((cx - tx) / z) * this.sx, y: ((cy - ty) / z) * this.sy };
  }

  async png(overlay?: CanvasImageSource, fill?: string): Promise<Uint8Array> {
    const c = document.createElement('canvas');
    c.width = this.width;
    c.height = this.height;
    const g = c.getContext('2d');
    if (!g) throw new Error('This system cannot compose the annotated image.');
    if (fill) {
      g.fillStyle = fill;
      g.fillRect(0, 0, c.width, c.height);
    } else if (this.bitmap) {
      g.drawImage(this.bitmap, 0, 0);
    }
    if (overlay) g.drawImage(overlay, 0, 0);
    const blob = await new Promise<Blob | null>((done) => c.toBlob(done, 'image/png'));
    if (!blob) throw new Error('The annotated image could not be encoded.');
    return new Uint8Array(await blob.arrayBuffer());
  }
}
