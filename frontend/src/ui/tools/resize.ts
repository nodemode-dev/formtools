import { api, type BatchOutput } from '../../io/api';
import { el, q, setHidden, setText } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import type { Jobs } from '../jobs';
import { InputList } from './inputs';
import { OutputPanel } from './output';

const MODES: Array<[string, string, string]> = [
  ['longest', 'Longest side', 'px'], ['shortest', 'Shortest side', 'px'], ['width', 'Width', 'px'], ['height', 'Height', 'px'],
  ['fit', 'Fit inside a box', 'box'], ['fill', 'Fill a box (crops the rest)', 'box'], ['exact', 'Exact size (stretches)', 'box'],
  ['percent', 'Percent', '%'], ['megapixels', 'Megapixels', 'MP'],
];

const PRESETS: Array<[string, number, number]> = [['Small', 854, 480], ['Medium', 1366, 768], ['Large', 1920, 1080], ['4K', 3840, 2160], ['Phone', 1170, 2532], ['Square post', 1080, 1080]];

export class ResizeTool {
  readonly root = el<HTMLElement>(`<div class="ft-tool-page" data-tool="resize">
      <div class="ft-tool-col ft-tool-left"></div>
      <div class="ft-tool-col ft-tool-mid">
        <section class="ft-panel">
          <header class="ft-panel-head"><span class="ft-panel-title">Size</span></header>
          <div class="ft-chips">${PRESETS.map(([n, w, h]) => `<button class="ft-chip" type="button" data-preset="${w}x${h}">${n} <span>${w} x ${h}</span></button>`).join('')}</div>
          <label class="ft-row"><span class="ft-row-label">Resize by</span><select class="cv-hf-sort ft-r-mode">${MODES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
          <label class="ft-row ft-r-one"><span class="ft-row-label ft-r-one-label">Size</span><span class="ft-num"><input type="number" class="ft-input ft-r-value" min="1" value="2048"> <span class="ft-r-unit">px</span></span></label>
          <label class="ft-row ft-r-box"><span class="ft-row-label">Width</span><span class="ft-num"><input type="number" class="ft-input ft-r-w" min="1" value="1920"> px</span></label>
          <label class="ft-row ft-r-box"><span class="ft-row-label">Height</span><span class="ft-num"><input type="number" class="ft-input ft-r-h" min="1" value="1080"> px</span></label>
          <label class="ft-row"><span class="ft-row-label">Make small pictures larger</span><input type="checkbox" class="ft-check ft-r-up"></label>
          <label class="ft-row"><span class="ft-row-label">Resampling</span><select class="cv-hf-sort ft-r-resample"><option value="lanczos">Lanczos (sharpest)</option><option value="bicubic">Bicubic</option><option value="bilinear">Bilinear</option><option value="nearest">Nearest (pixel art)</option></select></label>
        </section>
      </div>
      <div class="ft-tool-col ft-tool-right">
        <div class="ft-output-slot"></div>
        <div class="ft-run-bar"><button class="ft-btn is-primary" type="button" data-r="run">${icon('ftResize', 14)} Resize</button><span class="ft-run-state"></span></div>
      </div>
    </div>`);
  readonly inputs: InputList;
  readonly output = new OutputPanel();

  constructor(fromSelection: () => string[], private readonly jobs: Jobs, private readonly done: () => void) {
    this.inputs = new InputList(fromSelection);
    q(this.root, '.ft-tool-left').appendChild(this.inputs.root);
    q(this.root, '.ft-output-slot').replaceWith(this.output.root);
    const o: BatchOutput = { ...this.output.value, format: 'same', subfolder: 'resized' };
    this.output.set(o);
    q(this.root, '.ft-r-mode').addEventListener('change', () => this.syncMode());
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const preset = t?.closest<HTMLElement>('[data-preset]')?.dataset.preset;
      if (preset) {
        const [w, h] = preset.split('x');
        q<HTMLSelectElement>(this.root, '.ft-r-mode').value = 'fit';
        q<HTMLInputElement>(this.root, '.ft-r-w').value = w;
        q<HTMLInputElement>(this.root, '.ft-r-h').value = h;
        this.syncMode();
      }
      if (t?.closest('[data-r="run"]')) void this.run();
    });
    this.syncMode();
  }

  private syncMode(): void {
    const mode = q<HTMLSelectElement>(this.root, '.ft-r-mode').value;
    const m = MODES.find((x) => x[0] === mode)!;
    const box = m[2] === 'box';
    for (const n of this.root.querySelectorAll<HTMLElement>('.ft-r-box')) setHidden(n, !box);
    setHidden(q(this.root, '.ft-r-one'), box);
    setText(q(this.root, '.ft-r-unit'), m[2]);
    setText(q(this.root, '.ft-r-one-label'), m[1]);
  }

  private async run(): Promise<void> {
    if (!this.inputs.value.length) { toast('Add files or a folder first.', 'error'); return; }
    const num = (s: string): number => Number(q<HTMLInputElement>(this.root, s).value);
    const params = {
      mode: q<HTMLSelectElement>(this.root, '.ft-r-mode').value,
      width: num('.ft-r-w'), height: num('.ft-r-h'), value: num('.ft-r-value'),
      upscale: q<HTMLInputElement>(this.root, '.ft-r-up').checked,
      resample: q<HTMLSelectElement>(this.root, '.ft-r-resample').value,
    };
    const state = q(this.root, '.ft-run-state');
    const btn = q<HTMLButtonElement>(this.root, '[data-r="run"]');
    btn.disabled = true;
    try {
      const job = await api.batchRun({ inputs: this.inputs.value, recursive: this.inputs.recursive, extensions: [] }, [{ id: 'auto-orient', params: {} }, { id: 'resize', params }], this.output.value);
      this.jobs.track(job, (j) => {
        setText(state, j.state === 'running' ? `${j.done} of ${j.total}` : j.state === 'done' ? `Done: ${j.done} files${j.errors.length ? `, ${j.errors.length} errors` : ''}` : j.state === 'failed' ? 'Failed' : 'Stopped');
        if (j.state !== 'running') { btn.disabled = false; this.done(); }
      });
    } catch (e) {
      btn.disabled = false;
      toast(e instanceof Error ? e.message : 'The resize did not start.', 'error');
    }
  }
}
