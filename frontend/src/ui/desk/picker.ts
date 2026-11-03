import { COLOR_FORMATS, contrastText, formatColor, parseHex, toHex, type ColorFormat, type Rgb } from '../../desk/color';
import type { DeskResult, DeskTool } from '../../io/desk';
import { patchList, q, setDisabled, setHidden, setStyleVar, setText, setValue, el, setClass } from '../dom';
import { btn, copyText, DeskSection, startTool, type DeskDeps } from './common';
import { accelLabel } from './accel';
import { loadDeskPrefs, loadList, saveDeskPrefs, saveList } from './store';

interface Pick { id: string; r: number; g: number; b: number; at: number }

const KEY = 'formtools_desk_picks';
const MAX = 24;

const isPick = (v: unknown): v is Pick => {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.r === 'number' && typeof p.g === 'number' && typeof p.b === 'number' && typeof p.at === 'number';
};

const rgbOf = (p: Pick): Rgb => ({ r: p.r, g: p.g, b: p.b });

export class PickerSection extends DeskSection {
  private picks: Pick[] = loadList(KEY, isPick);
  private selected = '';

  constructor(deps: DeskDeps) {
    super('picker', 'Colour picker', 'ftPicker', 'The colour picker runs in the desktop app. Open formtools there to sample any pixel on your screen.', `
        <div class="ft-desk-actions">
          ${btn('pick', 'ftPicker', 'Pick a colour', true)}
          <span class="ft-desk-hint"></span>
          ${btn('clear', 'ftTrashCan', 'Clear the history')}
        </div>
        <div class="ft-desk-readout">
          <span class="ft-desk-big" aria-hidden="true"></span>
          <select class="cv-hf-sort" data-k="format" aria-label="Colour format">${COLOR_FORMATS.map(([f, l]) => `<option value="${f}">${l}</option>`).join('')}</select>
          <output class="ft-desk-value ft-mono" aria-live="off"></output>
          ${btn('copy', 'ftCopy', 'Copy')}
        </div>
        <div class="ft-desk-wrap">
          <p class="ft-note ft-desk-empty">No colours yet. Press Pick a colour, then click any pixel; the last ${MAX} stay here.</p>
          <div class="ft-desk-swatches" role="list"></div>
        </div>`, deps);
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const sw = t?.closest<HTMLElement>('[data-pick]')?.dataset.pick;
      if (sw) { this.selected = sw; this.paint(); return; }
      const act = t?.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'pick') this.run('picker');
      else if (act === 'copy') this.copy();
      else if (act === 'clear') { this.picks = []; this.selected = ''; this.save(); this.paint(); }
    });
    this.root.addEventListener('dblclick', (e) => {
      const sw = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-pick]')?.dataset.pick : undefined;
      if (sw) { this.selected = sw; this.paint(); this.copy(); }
    });
    q<HTMLSelectElement>(this.root, '[data-k="format"]').addEventListener('change', (e) => {
      const f = (e.target as HTMLSelectElement).value as ColorFormat;
      saveDeskPrefs({ ...loadDeskPrefs(), format: f });
      this.paint();
    });
    this.selected = this.picks[0]?.id ?? '';
    this.paint();
  }

  protected override ready(): void { this.paint(); }

  override shown(): void {
    const prefs = loadDeskPrefs();
    setValue(q<HTMLSelectElement>(this.root, '[data-k="format"]'), prefs.format);
    setText(q(this.root, '.ft-desk-hint'), prefs.enabled.picker && prefs.accel.picker ? `Shortcut ${accelLabel(prefs.accel.picker)}` : '');
    this.paint();
  }

  override run(tool: DeskTool = 'picker'): void {
    if (!this.supported) return;
    void startTool(tool, { format: loadDeskPrefs().format }, this.deps);
  }

  override result(r: DeskResult): void {
    if (r.kind === 'error') { this.deps.status(String(r.value)); return; }
    if (r.kind !== 'colour') return;
    const v = r.value as { hex?: string; rgb?: Rgb; text?: string } | null;
    const rgb = v?.rgb && typeof v.rgb.r === 'number' ? v.rgb : parseHex(v?.hex ?? '');
    if (!rgb) return;
    const at = Date.now();
    const pick: Pick = { id: `${at}-${toHex(rgb)}`, r: rgb.r, g: rgb.g, b: rgb.b, at };
    this.picks = [pick, ...this.picks].slice(0, MAX);
    this.selected = pick.id;
    this.save();
    this.paint();
    this.deps.status(`Picked ${v?.text ?? formatColor(rgb, loadDeskPrefs().format)}.`);
  }

  private save(): void { saveList(KEY, this.picks); }

  private current(): Pick | undefined { return this.picks.find((p) => p.id === this.selected) ?? this.picks[0]; }

  private format(): ColorFormat { return q<HTMLSelectElement>(this.root, '[data-k="format"]').value as ColorFormat; }

  private copy(): void {
    const p = this.current();
    if (p) void copyText(formatColor(rgbOf(p), this.format()), this.deps, `Copied ${formatColor(rgbOf(p), this.format())}`);
  }

  private paint(): void {
    const cur = this.current();
    setHidden(q(this.root, '.ft-desk-empty'), this.picks.length > 0);
    setDisabled(q<HTMLButtonElement>(this.root, '[data-act="clear"]'), this.picks.length === 0);
    setDisabled(q<HTMLButtonElement>(this.root, '[data-act="copy"]'), !cur);
    setText(q(this.root, '.ft-desk-value'), cur ? formatColor(rgbOf(cur), this.format()) : '');
    const big = q(this.root, '.ft-desk-big');
    setStyleVar(big, '--sw', cur ? toHex(rgbOf(cur)) : 'transparent');
    setClass(big, 'is-empty', !cur);
    patchList(q(this.root, '.ft-desk-swatches'), this.picks, {
      key: (p) => p.id,
      create: (p) => {
        const n = el<HTMLElement>(`<button type="button" class="ft-desk-sw" role="listitem" data-pick="${p.id}"></button>`);
        setStyleVar(n, '--sw', toHex(rgbOf(p)));
        setStyleVar(n, '--ink', contrastText(rgbOf(p)));
        n.title = `${toHex(rgbOf(p)).toUpperCase()}, ${new Date(p.at).toLocaleTimeString()}`;
        setClass(n, 'is-on', p.id === (cur?.id ?? ''));
        return n;
      },
      update: (n, p) => setClass(n, 'is-on', p.id === (cur?.id ?? '')),
    });
  }
}
