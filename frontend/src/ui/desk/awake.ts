import { desk, type AwakeRequest, type AwakeState } from '../../io/desk';
import { q, setChecked, setDisabled, setText } from '../dom';
import { toast } from '../toast';
import { DeskSection, clock, type DeskDeps } from './common';

const SPANS: Array<[number, string]> = [[15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours'], [480, '8 hours']];

const untilMs = (u: number): number => (u > 1e12 ? u : u * 1000);

function left(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

export class AwakeSection extends DeskSection {
  private state: AwakeState = { mode: 'off', display: false, until: null };
  private tick = 0;
  private busy = false;
  private want: AwakeState['mode'] | null = null;
  private readonly radios: HTMLInputElement[];
  private readonly span: HTMLSelectElement;
  private readonly screen: HTMLInputElement;

  constructor(deps: DeskDeps) {
    super('awake', 'Awake', 'ftAwake', 'Awake runs in the desktop app. Open formtools there to keep this computer from going to sleep.', `
        <div class="ft-desk-awake">
          <label class="ft-radio"><input type="radio" name="ft-awake-mode" value="off"> Off, sleep as usual</label>
          <label class="ft-radio"><input type="radio" name="ft-awake-mode" value="on"> On, until I turn it off</label>
          <label class="ft-radio"><input type="radio" name="ft-awake-mode" value="timed"> On, for
            <select class="cv-hf-sort ft-desk-span" aria-label="How long to stay awake">${SPANS.map(([m, l]) => `<option value="${m}">${l}</option>`).join('')}</select></label>
          <label class="ft-radio"><input type="checkbox" class="ft-check ft-desk-screen"> Keep the screen on too</label>
        </div>
        <p class="ft-desk-live" role="status"></p>
        <p class="ft-note">Awake lasts only while formtools is running. Quitting formtools lets the computer sleep again.</p>`, deps);
    this.radios = Array.from(this.root.querySelectorAll<HTMLInputElement>('input[name="ft-awake-mode"]'));
    this.span = q<HTMLSelectElement>(this.root, '.ft-desk-span');
    this.screen = q<HTMLInputElement>(this.root, '.ft-desk-screen');
    this.span.value = '60';
    for (const r of this.radios) r.addEventListener('change', () => { if (r.checked) void this.apply(r.value as AwakeState['mode']); });
    this.span.addEventListener('change', () => { if (this.state.mode === 'timed') void this.apply('timed'); });
    this.screen.addEventListener('change', () => { if (this.state.mode !== 'off') void this.apply(this.state.mode); });
    this.paint();
  }

  override shown(): void {
    if (!this.supported) return;
    void desk.awakeGet().then((s) => { this.state = s; this.paint(); }).catch(() => undefined);
  }

  private async apply(mode: AwakeState['mode']): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.want = mode;
    this.paint();
    const req: AwakeRequest = mode === 'timed' ? { mode, minutes: Number(this.span.value), display: this.screen.checked } : { mode, display: this.screen.checked };
    try {
      this.state = await desk.awakeSet(req);
      this.deps.status(mode === 'off' ? 'Awake is off.' : 'Awake is on.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Awake did not change.', 'error');
    }
    this.busy = false;
    this.want = null;
    this.paint();
  }

  private paint(): void {
    const shown = this.want ?? this.state.mode;
    for (const r of this.radios) { setChecked(r, r.value === shown); setDisabled(r, this.busy); }
    setDisabled(this.span, this.busy);
    setDisabled(this.screen, this.busy);
    setChecked(this.screen, this.state.mode === 'off' ? this.screen.checked : this.state.display);
    this.live();
    if (this.state.mode === 'timed' && !this.tick) this.tick = window.setInterval(() => this.live(), 1000);
    if (this.state.mode !== 'timed' && this.tick) { window.clearInterval(this.tick); this.tick = 0; }
  }

  private live(): void {
    const out = q(this.root, '.ft-desk-live');
    const s = this.state;
    if (s.mode === 'off') { setText(out, 'Off. The computer sleeps on its normal schedule.'); return; }
    const what = s.display ? 'Keeping the computer and the screen awake' : 'Keeping the computer awake';
    if (s.mode === 'on' || s.until === null) { setText(out, `${what} until you turn it off.`); return; }
    const end = untilMs(s.until);
    const remaining = end - Date.now();
    if (remaining <= 0) {
      setText(out, 'Finishing up.');
      if (!this.busy) { this.busy = true; void desk.awakeGet().then((n) => { this.state = n; }).catch(() => undefined).then(() => { this.busy = false; this.paint(); }); }
      return;
    }
    setText(out, `${what} for another ${left(remaining)}, until ${clock(end)}.`);
  }
}
