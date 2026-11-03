import { COLOR_FORMATS } from '../../desk/color';
import { desk, type DeskCaps, type ShortcutBinding, type ShortcutResult } from '../../io/desk';
import { el, q, setChecked, setDisabled, setHidden, setText, setValue } from '../dom';
import { icon } from '../icons';
import './icons';
import { ShortcutField } from './recorder';
import {
  bindingsOf, DEFAULT_ACCEL, deskCaps, loadDeskPrefs, onDeskPrefs, saveDeskPrefs, SHORTCUT_IDS, SHORTCUT_LABELS, ZOOM_STARTS,
  type DeskPrefsData, type ShortcutId,
} from './store';

const SUPPORT_OF: Record<ShortcutId, string> = { picker: 'picker', ruler: 'ruler', text: 'text', zoom: 'zoom', draw: 'draw', timer: 'timer', topmost: 'topmost' };

export class DeskPrefs {
  readonly root: HTMLElement;
  private readonly fields = new Map<ShortcutId, ShortcutField>();
  private readonly changeFns: Array<(p: DeskPrefsData) => void> = [];
  private readonly bindingFns: Array<(b: ShortcutBinding[]) => void> = [];
  private lastBindings = '';
  private caps: DeskCaps | null = null;

  constructor() {
    this.root = el<HTMLElement>(`<section class="ft-sec ft-desk-prefs" data-sec="desk">
        <h3>Desktop utilities</h3>
        <p class="ft-note ft-desk-pnote"></p>
        <div class="ft-desk-pkeys">${SHORTCUT_IDS.map((id) => `<div class="ft-desk-krow" data-sc="${id}">
            <input type="checkbox" class="ft-check" data-en="${id}" aria-label="Turn on the ${SHORTCUT_LABELS[id]} shortcut">
            <span class="ft-desk-klabel">${SHORTCUT_LABELS[id]}</span>
            <span class="ft-desk-kslot"></span>
          </div>`).join('')}</div>
        <div class="ft-row ft-desk-krow-reset"><span class="ft-row-label">Shortcuts: click a field, then press the keys. Escape cancels, Backspace clears.</span><button class="ft-btn" type="button" data-pd="reset">${icon('undo', 14)} Restore the defaults</button></div>
        <label class="ft-row" data-pd-row="picker"><span class="ft-row-label">Colour picker format</span><select class="cv-hf-sort" data-pd="format">${COLOR_FORMATS.map(([f, l]) => `<option value="${f}">${l}</option>`).join('')}</select></label>
        <label class="ft-row" data-pd-row="text"><span class="ft-row-label">Text extractor language</span><select class="cv-hf-sort" data-pd="lang"><option value="">Automatic</option></select></label>
        <label class="ft-row" data-pd-row="timer"><span class="ft-row-label">Break timer minutes</span><input type="number" class="ft-input" data-pd="timerMinutes" min="1" max="120" step="1" inputmode="numeric"></label>
        <label class="ft-row" data-pd-row="zoom"><span class="ft-row-label">Zoom starts at</span><select class="cv-hf-sort" data-pd="zoomStart">${ZOOM_STARTS.map((z) => `<option value="${z}">${z} times</option>`).join('')}</select></label>
      </section>`);
    for (const id of SHORTCUT_IDS) {
      const f = new ShortcutField(SHORTCUT_LABELS[id]);
      q(this.root, `[data-sc="${id}"] .ft-desk-kslot`).replaceWith(f.root);
      this.fields.set(id, f);
      f.onChange((accel) => this.edit((p) => { p.accel[id] = accel; }));
    }
    this.root.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
      const en = t instanceof HTMLInputElement ? t.dataset.en as ShortcutId | undefined : undefined;
      if (en) { this.edit((p) => { p.enabled[en] = (t as HTMLInputElement).checked; }); return; }
      const key = t.dataset.pd;
      if (key === 'format') this.edit((p) => { p.format = t.value as DeskPrefsData['format']; });
      else if (key === 'lang') this.edit((p) => { p.lang = t.value; });
      else if (key === 'timerMinutes') this.edit((p) => { p.timerMinutes = Number(t.value) || 5; });
      else if (key === 'zoomStart') this.edit((p) => { p.zoomStart = Number(t.value); });
    });
    this.root.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('[data-pd="reset"]')) this.edit((p) => { p.accel = { ...DEFAULT_ACCEL }; });
    });
    onDeskPrefs((p) => {
      this.paint(p);
      for (const fn of this.changeFns) fn(p);
      const sig = JSON.stringify(bindingsOf(p));
      if (sig !== this.lastBindings) { this.lastBindings = sig; for (const fn of this.bindingFns) fn(bindingsOf(p)); }
    });
    this.lastBindings = JSON.stringify(this.bindings());
    this.paint(this.load());
    void deskCaps().then((c) => { this.caps = c; this.paint(this.load()); });
  }

  load(): DeskPrefsData { return loadDeskPrefs(); }

  bindings(): ShortcutBinding[] { return bindingsOf(this.load()); }

  onChange(fn: (p: DeskPrefsData) => void): void { this.changeFns.push(fn); }

  onBindingsChange(fn: (b: ShortcutBinding[]) => void): void { this.bindingFns.push(fn); }

  refresh(): void { this.paint(this.load()); }

  async apply(): Promise<ShortcutResult[]> {
    if (!desk.available()) return [];
    const results = await desk.setShortcuts(this.bindings());
    this.showResults(results);
    return results;
  }

  showResults(results: ShortcutResult[]): void {
    const by = new Map(results.map((r) => [r.id, r]));
    for (const id of SHORTCUT_IDS) {
      const r = by.get(id);
      this.fields.get(id)?.setError(r && !r.ok ? (r.error || 'Another program already uses these keys.') : this.clash(id));
    }
  }

  private clash(id: ShortcutId): string {
    const p = this.load();
    if (!p.enabled[id] || !p.accel[id]) return '';
    const other = SHORTCUT_IDS.find((o) => o !== id && p.enabled[o] && p.accel[o] === p.accel[id]);
    return other ? `Same keys as ${SHORTCUT_LABELS[other]}.` : '';
  }

  private edit(change: (p: DeskPrefsData) => void): void {
    const p = this.load();
    change(p);
    saveDeskPrefs(p);
  }

  private paint(p: DeskPrefsData): void {
    const caps = this.caps;
    const live = desk.available();
    setText(q(this.root, '.ft-desk-pnote'), live ? 'Global shortcuts work from any program while formtools is running.' : 'Shortcuts and the screen utilities work in the desktop app.');
    for (const id of SHORTCUT_IDS) {
      const row = q(this.root, `[data-sc="${id}"]`);
      const ok = !caps || caps.utilities[SUPPORT_OF[id] as keyof DeskCaps['utilities']]?.ok !== false;
      setHidden(row, !ok);
      const en = q<HTMLInputElement>(row, `[data-en="${id}"]`);
      setChecked(en, p.enabled[id]);
      setDisabled(en, !live);
      const f = this.fields.get(id);
      f?.set(p.accel[id]);
      f?.setDisabled(!live || !p.enabled[id]);
      if (f) f.setError(this.clash(id));
    }
    for (const row of this.root.querySelectorAll<HTMLElement>('[data-pd-row]')) {
      const key = row.dataset.pdRow as keyof DeskCaps['utilities'];
      setHidden(row, caps !== null && caps.utilities[key]?.ok === false);
    }
    const lang = q<HTMLSelectElement>(this.root, '[data-pd="lang"]');
    const wanted = new Set(caps?.ocr.languages ?? []);
    if (p.lang) wanted.add(p.lang);
    const have = new Set(Array.from(lang.options).map((o) => o.value));
    for (const l of wanted) if (!have.has(l)) lang.append(new Option(l, l));
    setValue(lang, p.lang);
    setValue(q<HTMLSelectElement>(this.root, '[data-pd="format"]'), p.format);
    setValue(q<HTMLInputElement>(this.root, '[data-pd="timerMinutes"]'), String(p.timerMinutes));
    setValue(q<HTMLSelectElement>(this.root, '[data-pd="zoomStart"]'), String(p.zoomStart));
    for (const c of this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('[data-pd]')) setDisabled(c, !live);
  }
}
