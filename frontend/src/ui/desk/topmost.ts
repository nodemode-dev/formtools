import { desk, type DeskCaps, type DeskTool } from '../../io/desk';
import { q, setDisabled, setText } from '../dom';
import { toast } from '../toast';
import { accelLabel } from './accel';
import { btn, DeskSection, type DeskDeps } from './common';
import { loadDeskPrefs } from './store';

const COUNT = 3;

export class TopmostSection extends DeskSection {
  private timer = 0;
  private reason = '';

  constructor(deps: DeskDeps) {
    super('topmost', 'Always on top', 'ftTopmost', 'Always on top runs in the desktop app. Open formtools there to keep another program\'s window above the rest.', `
        <div class="ft-desk-actions">
          ${btn('toggle', 'ftTopmost', 'Pin or release a window', true)}
          <span class="ft-desk-hint"></span>
        </div>
        <p class="ft-desk-live" role="status"></p>
        <p class="ft-note ft-desk-support"></p>
        <p class="ft-note">Press the button, then switch to the window you want within ${COUNT} seconds. formtools toggles that window: if it was pinned it is released, otherwise it is pinned above every other window.</p>`, deps);
    this.root.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('[data-act="toggle"]')) this.countdown();
    });
  }

  override describe(caps: DeskCaps): void {
    this.reason = caps.utilities.topmost.reason;
    setText(q(this.root, '.ft-desk-support'), caps.utilities.topmost.ok ? 'Works on the window that is in front of formtools. formtools\' own windows are skipped.' : this.reason);
  }

  override shown(): void {
    const p = loadDeskPrefs();
    setText(q(this.root, '.ft-desk-hint'), p.enabled.topmost && p.accel.topmost ? `Shortcut ${accelLabel(p.accel.topmost)} toggles at once` : '');
  }

  override run(_tool?: DeskTool): void {
    if (this.supported && !this.timer) void this.toggle();
  }

  private countdown(): void {
    if (this.timer || !this.supported) return;
    const button = q<HTMLButtonElement>(this.root, '[data-act="toggle"]');
    const label = q(button, '.ft-u-btn-label');
    const original = label.textContent ?? '';
    setDisabled(button, true);
    let n = COUNT;
    setText(label, `Switch windows now: ${n}`);
    this.timer = window.setInterval(() => {
      n -= 1;
      if (n > 0) { setText(label, `Switch windows now: ${n}`); return; }
      window.clearInterval(this.timer);
      this.timer = 0;
      setText(label, original);
      setDisabled(button, false);
      void this.toggle();
    }, 1000);
  }

  private async toggle(): Promise<void> {
    const out = q(this.root, '.ft-desk-live');
    try {
      const r = await desk.topmost();
      if (!r.ok) { const t = r.error ?? this.reason ?? 'That window could not be changed.'; setText(out, t); this.deps.status(t); return; }
      const t = r.on ? `Pinned ${r.title || 'the window'} above the others.` : `Released ${r.title || 'the window'}.`;
      setText(out, t);
      this.deps.status(t);
    } catch (e) {
      const t = e instanceof Error ? e.message : 'That window could not be changed.';
      setText(out, t);
      toast(t, 'error');
    }
  }
}
