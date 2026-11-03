import type { BatchOutput } from '../../io/api';
import { el, q, setChecked, setHidden, setText, setValue } from '../dom';

export const DEFAULT_OUTPUT: BatchOutput = {
  format: 'jpeg', quality: 90, folder: '', subfolder: 'converted', naming: '{name}', overwrite: 'rename', keep_metadata: true, keep_folders: false, keep_dates: false,
};

export class OutputPanel {
  readonly root = el<HTMLElement>(`<section class="ft-panel ft-output">
      <header class="ft-panel-head"><span class="ft-panel-title">Output</span></header>
      <label class="ft-row"><span class="ft-row-label">Format</span><select class="cv-hf-sort" data-o="format">
        <option value="same">Same as each file</option><option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option><option value="avif">AVIF</option><option value="tiff">TIFF</option><option value="bmp">BMP</option><option value="gif">GIF</option></select></label>
      <label class="ft-row ft-o-quality"><span class="ft-row-label">Quality</span><span class="ft-range"><input type="range" min="1" max="100" data-o="quality"><output class="ft-range-out"></output></span></label>
      <label class="ft-row"><span class="ft-row-label">Folder</span><input type="text" class="ft-input ft-input-wide" spellcheck="false" data-o="folder" placeholder="Beside each file"></label>
      <label class="ft-row"><span class="ft-row-label">Sub-folder</span><input type="text" class="ft-input" spellcheck="false" data-o="subfolder" placeholder="None"></label>
      <label class="ft-row"><span class="ft-row-label">File name</span><input type="text" class="ft-input ft-input-wide ft-mono" spellcheck="false" data-o="naming"></label>
      <p class="ft-note ft-tokens">Tokens: {name} {ext} {n} {n:3} {date} {date:%Y-%m-%d} {width} {height} {folder} {exif:Model}</p>
      <label class="ft-row"><span class="ft-row-label">When a file exists</span><select class="cv-hf-sort" data-o="overwrite"><option value="rename">Add a number</option><option value="skip">Skip it</option><option value="replace">Replace it</option></select></label>
      <label class="ft-row"><span class="ft-row-label">Keep metadata and colour profile</span><input type="checkbox" class="ft-check" data-o="keep_metadata"></label>
      <label class="ft-row"><span class="ft-row-label">Keep the folder structure</span><input type="checkbox" class="ft-check" data-o="keep_folders"></label>
      <label class="ft-row"><span class="ft-row-label">Keep the original dates</span><input type="checkbox" class="ft-check" data-o="keep_dates"></label>
    </section>`);
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.set(DEFAULT_OUTPUT);
    this.root.addEventListener('input', (e) => { this.sync(e.target); this.emit(); });
    this.root.addEventListener('change', () => this.emit());
  }

  onChange(fn: () => void): void { this.listeners.add(fn); }

  private emit(): void { for (const l of this.listeners) l(); }

  private sync(t: EventTarget | null): void {
    const fmt = q<HTMLSelectElement>(this.root, '[data-o="format"]').value;
    setHidden(q(this.root, '.ft-o-quality'), !['jpeg', 'webp', 'avif', 'same'].includes(fmt));
    if (t === null || (t instanceof HTMLInputElement && t.dataset.o === 'quality')) setText(q(this.root, '.ft-o-quality output'), q<HTMLInputElement>(this.root, '[data-o="quality"]').value);
  }

  set(o: BatchOutput): void {
    for (const n of this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-o]')) {
      const v = o[n.dataset.o as keyof BatchOutput];
      if (n instanceof HTMLInputElement && n.type === 'checkbox') setChecked(n, v === true);
      else setValue(n, String(v));
    }
    this.sync(null);
  }

  get value(): BatchOutput {
    const get = (k: string): HTMLInputElement | HTMLSelectElement => q(this.root, `[data-o="${k}"]`);
    const chk = (k: string): boolean => (get(k) as HTMLInputElement).checked;
    return {
      format: get('format').value as BatchOutput['format'],
      quality: Number(get('quality').value),
      folder: get('folder').value.trim(),
      subfolder: get('subfolder').value.trim(),
      naming: get('naming').value.trim() || '{name}',
      overwrite: get('overwrite').value as BatchOutput['overwrite'],
      keep_metadata: chk('keep_metadata'),
      keep_folders: chk('keep_folders'),
      keep_dates: chk('keep_dates'),
    };
  }
}
