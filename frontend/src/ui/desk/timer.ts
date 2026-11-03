import type { DeskTool } from '../../io/desk';
import { q, setText, setValue } from '../dom';
import { accelLabel } from './accel';
import { btn, DeskSection, startTool, type DeskDeps } from './common';
import { loadDeskPrefs, saveDeskPrefs } from './store';

export class TimerSection extends DeskSection {
  private readonly input: HTMLInputElement;

  constructor(deps: DeskDeps) {
    super('timer', 'Break timer', 'ftTimer', 'The break timer runs in the desktop app. Open formtools there to dim the screen for a few minutes.', `
        <div class="ft-desk-actions">
          <label class="ft-num">Minutes <input type="number" class="ft-input ft-desk-minutes" min="1" max="120" step="1" inputmode="numeric" aria-label="Minutes"></label>
          ${btn('start', 'ftTimer', 'Start a break', true)}
          <span class="ft-desk-hint"></span>
        </div>
        <p class="ft-note">The screen dims and a countdown fills it. Press Escape to end the break early.</p>`, deps);
    this.input = q<HTMLInputElement>(this.root, '.ft-desk-minutes');
    const store = (): number => {
      const n = Math.min(120, Math.max(1, Math.round(Number(this.input.value) || 5)));
      saveDeskPrefs({ ...loadDeskPrefs(), timerMinutes: n });
      return n;
    };
    this.input.addEventListener('input', () => { if (Number(this.input.value) >= 1) store(); });
    this.input.addEventListener('change', () => { this.input.value = String(store()); });
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.run('timer'); } });
    this.root.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('[data-act="start"]')) this.run('timer');
    });
  }

  override shown(): void {
    const p = loadDeskPrefs();
    setValue(this.input, String(p.timerMinutes));
    setText(q(this.root, '.ft-desk-hint'), p.enabled.timer && p.accel.timer ? `Shortcut ${accelLabel(p.accel.timer)}` : '');
  }

  override run(tool: DeskTool = 'timer'): void {
    if (!this.supported) return;
    void startTool(tool, { minutes: loadDeskPrefs().timerMinutes }, this.deps);
  }
}
