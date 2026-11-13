import { api, type EditOp, type EditOut, type Entry } from '../io/api';
import { el, q, setChecked, setHidden, setText, setValue } from './dom';
import { icon } from './icons';
import { toast } from './toast';

type Mode = 'resize' | 'crop' | 'save';

const FORMATS: Array<[string, string]> = [['', 'Same as the original'], ['jpeg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP'], ['avif', 'AVIF'], ['tiff', 'TIFF']];

export class SaveDialog {
  readonly root = el<HTMLElement>(`<div class="cv-scrim ft-save-scrim" hidden>
      <div class="cv-dialog ft-save" role="dialog" aria-modal="true" aria-label="Save">
        <header class="ft-dlg-head"><span class="ft-dlg-title"></span><button class="cv-tt-btn" type="button" data-close aria-label="Close">${icon('close', 16)}</button></header>
        <div class="ft-save-body">
          <div class="ft-save-size">
            <label class="ft-row"><span class="ft-row-label">Width</span><span class="ft-num"><input type="number" class="ft-input ft-w" min="1" max="100000"> px</span></label>
            <label class="ft-row"><span class="ft-row-label">Height</span><span class="ft-num"><input type="number" class="ft-input ft-h" min="1" max="100000"> px</span></label>
            <label class="ft-row"><span class="ft-row-label">Keep proportions</span><input type="checkbox" class="ft-check ft-lock" checked></label>
            <label class="ft-row"><span class="ft-row-label">Resampling</span><select class="cv-hf-sort ft-resample"><option value="lanczos">Lanczos (sharpest)</option><option value="bicubic">Bicubic</option><option value="bilinear">Bilinear</option><option value="nearest">Nearest (pixel art)</option></select></label>
          </div>
          <p class="ft-note ft-save-crop"></p>
          <label class="ft-row"><span class="ft-row-label">Format</span><select class="cv-hf-sort ft-format">${FORMATS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
          <label class="ft-row ft-quality-row"><span class="ft-row-label">Quality</span><span class="ft-range"><input type="range" class="ft-quality" min="1" max="100" value="90"><output class="ft-range-out ft-quality-out">90</output></span></label>
          <div class="ft-row ft-row-col"><span class="ft-row-label">Save to</span>
            <label class="ft-radio"><input type="radio" name="ft-dest" value="new" checked> A new file beside the original</label>
            <label class="ft-radio"><input type="radio" name="ft-dest" value="replace"> Replace the original</label>
          </div>
        </div>
        <footer class="ft-dlg-foot"><button class="ft-btn" type="button" data-close>Cancel</button><button class="ft-btn is-primary" type="button" data-save>Save</button></footer>
      </div></div>`);
  private entry: Entry | null = null;
  private base = { w: 0, h: 0 };
  private ops: EditOp[] = [];
  private mode: Mode = 'save';
  private done: (path: string) => void = () => undefined;
  private lastFocus: Element | null = null;
  private saving = false;
  private readonly w = q<HTMLInputElement>(this.root, '.ft-w');
  private readonly h = q<HTMLInputElement>(this.root, '.ft-h');

  constructor() {
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t === this.root || t?.closest('[data-close]')) this.close();
      else if (t?.closest('[data-save]')) void this.save();
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
      else if (e.key === 'Enter' && !(e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement)) { e.preventDefault(); void this.save(); }
    });
    this.w.addEventListener('input', () => { if (this.locked() && this.base.w) setValue(this.h, String(Math.max(1, Math.round(Number(this.w.value) * this.base.h / this.base.w)))); });
    this.h.addEventListener('input', () => { if (this.locked() && this.base.h) setValue(this.w, String(Math.max(1, Math.round(Number(this.h.value) * this.base.w / this.base.h)))); });
    const quality = q<HTMLInputElement>(this.root, '.ft-quality');
    quality.addEventListener('input', () => setText(q(this.root, '.ft-quality-out'), quality.value));
    q<HTMLSelectElement>(this.root, '.ft-format').addEventListener('change', () => this.syncQuality());
  }

  private locked(): boolean { return q<HTMLInputElement>(this.root, '.ft-lock').checked; }

  private syncQuality(): void {
    const f = q<HTMLSelectElement>(this.root, '.ft-format').value || (this.entry?.ext ?? '');
    setHidden(q(this.root, '.ft-quality-row'), !['jpeg', 'jpg', 'webp', 'avif'].includes(f));
  }

  get isOpen(): boolean { return !this.root.hidden; }

  open(mode: Mode, entry: Entry, size: { w: number; h: number }, ops: EditOp[], done: (path: string) => void): void {
    this.mode = mode;
    this.entry = entry;
    this.base = size;
    this.ops = ops;
    this.done = done;
    setText(q(this.root, '.ft-dlg-title'), mode === 'resize' ? 'Resize' : mode === 'crop' ? 'Save the crop' : 'Save as');
    setHidden(q(this.root, '.ft-save-size'), mode !== 'resize');
    const crop = ops.find((o) => o.op === 'crop');
    const note = q(this.root, '.ft-save-crop');
    setText(note, crop && crop.op === 'crop' ? `Crop to ${crop.w} x ${crop.h} px from ${crop.x}, ${crop.y}.` : '');
    setHidden(note, !crop);
    setValue(this.w, String(size.w));
    setValue(this.h, String(size.h));
    setValue(q(this.root, '.ft-format'), '');
    setChecked(q(this.root, 'input[value="new"]'), true);
    this.syncQuality();
    this.lastFocus = document.activeElement;
    this.root.hidden = false;
    (mode === 'resize' ? this.w : q<HTMLElement>(this.root, '[data-save]')).focus();
    if (mode === 'resize') this.w.select();
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    if (this.lastFocus instanceof HTMLElement) this.lastFocus.focus({ preventScroll: true });
  }

  private async save(): Promise<void> {
    const e = this.entry;
    if (!e || this.saving) return;
    const ops = [...this.ops];
    if (this.mode === 'resize') {
      const width = Math.round(Number(this.w.value)), height = Math.round(Number(this.h.value));
      if (!(width > 0 && height > 0)) { toast('Width and height must be at least 1 pixel.', 'error'); return; }
      ops.push({ op: 'resize', width, height, resample: q<HTMLSelectElement>(this.root, '.ft-resample').value as 'lanczos' });
    }
    const format = q<HTMLSelectElement>(this.root, '.ft-format').value as EditOut['format'] | '';
    const replace = q<HTMLInputElement>(this.root, 'input[value="replace"]').checked;
    const out: EditOut = {};
    if (format) out.format = format;
    if (!q(this.root, '.ft-quality-row').hidden) out.quality = Number(q<HTMLInputElement>(this.root, '.ft-quality').value);
    if (replace) {
      if (format && format !== e.ext && !(format === 'jpeg' && (e.ext === 'jpg' || e.ext === 'jpeg'))) { toast('Replacing the original keeps its format. Choose "A new file" to change the format.', 'error'); return; }
      out.path = e.path;
    }
    const btn = q<HTMLButtonElement>(this.root, '[data-save]');
    btn.disabled = true;
    this.saving = true;
    try {
      const r = await api.edit(e.path, ops, out, replace);
      this.close();
      toast(`Saved ${r.path.split(/[\\/]/).pop()}.`);
      this.done(r.path);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The picture was not saved.', 'error');
    } finally {
      btn.disabled = false;
      this.saving = false;
    }
  }
}
