import type { DeskResult, DeskTool } from '../../io/desk';
import { q, setDisabled, setText } from '../dom';
import { accelLabel } from './accel';
import { btn, DeskSection, startTool, textOf, type DeskDeps } from './common';
import { HistoryList } from './history';
import { loadDeskPrefs } from './store';

export class RulerSection extends DeskSection {
  private readonly history: HistoryList;

  constructor(deps: DeskDeps) {
    super('ruler', 'Screen ruler', 'ftRuler', 'The screen ruler runs in the desktop app. Open formtools there to measure anything on your screen in pixels.', `
        <div class="ft-desk-actions">
          ${btn('measure', 'ftRuler', 'Measure', true)}
          <span class="ft-desk-hint"></span>
          ${btn('clear', 'ftTrashCan', 'Clear the list')}
        </div>
        <p class="ft-note">Drag a box for Bounds, or press 2 for Spacing, 3 for Horizontal and 4 for Vertical. Click to copy the size. Numbers are in physical pixels. Escape closes the ruler.</p>
        <div class="ft-desk-history-slot"></div>`, deps);
    this.history = new HistoryList('formtools_desk_measures', 20, 'No measurements yet. Press Measure to draw on a frozen copy of the screen.', deps, () => this.sync());
    q(this.root, '.ft-desk-history-slot').replaceWith(this.history.root);
    this.root.addEventListener('click', (e) => {
      const act = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
      if (act === 'measure') this.run('ruler');
      else if (act === 'clear') this.history.clear();
    });
    this.sync();
  }

  override shown(): void {
    const p = loadDeskPrefs();
    setText(q(this.root, '.ft-desk-hint'), p.enabled.ruler && p.accel.ruler ? `Shortcut ${accelLabel(p.accel.ruler)}` : '');
  }

  override run(tool: DeskTool = 'ruler'): void {
    if (this.supported) void startTool(tool, {}, this.deps);
  }

  override result(r: DeskResult): void {
    if (r.kind === 'error') { this.deps.status(String(r.value)); return; }
    if (r.kind !== 'measure') return;
    const text = textOf(r.value);
    if (!text) return;
    this.history.add(text);
    this.deps.status(`Measured ${text}.`);
  }

  private sync(): void { setDisabled(q<HTMLButtonElement>(this.root, '[data-act="clear"]'), this.history.size === 0); }
}
