import { api, type AgentAccess, type AgentRequest, type AgentState } from '../io/api';
import { el, q, setDisabled, setHidden, setText } from './dom';
import { icon } from './icons';
import { toast } from './toast';
import { selectRow, type Row } from './settings/rows';

type Listener = (state: AgentState) => void;

const listeners = new Set<Listener>();
let last: AgentState | null = null;
let inflight: Promise<AgentState | null> | null = null;

const EFFECTS: Record<AgentRequest['effect'], string> = {
  reads: 'It only looks at things.',
  adds: 'It adds new files and never replaces one that exists.',
  alters: 'It can delete, move or overwrite files.',
};

export function refreshAgentState(): Promise<AgentState | null> {
  if (inflight) return inflight;
  inflight = api.agentState().then((s) => { last = s; for (const fn of listeners) fn(s); return s; }, () => last).finally(() => { inflight = null; });
  return inflight;
}

export function onAgentState(fn: Listener): void {
  listeners.add(fn);
  if (last) fn(last);
}

export class ConsentDialog {
  readonly root = el<HTMLElement>(`<div class="cv-scrim ft-consent-scrim" hidden>
      <div class="cv-dialog ft-consent" role="alertdialog" aria-modal="true" aria-labelledby="ft-consent-title" aria-describedby="ft-consent-body">
        <header class="ft-dlg-head"><span class="ft-dlg-title" id="ft-consent-title">Allow an outside agent to change this?</span><span class="ft-consent-mark">${icon('agent', 18)}</span></header>
        <div class="ft-consent-body" id="ft-consent-body">
          <p class="ft-consent-what"></p>
          <p class="ft-note ft-consent-effect"></p>
          <p class="ft-note ft-consent-reset" hidden></p>
          <p class="ft-note">If nobody answers within two minutes the request is refused.</p>
        </div>
        <footer class="ft-dlg-foot">
          <button class="ft-btn" type="button" data-answer="deny">Deny</button>
          <button class="ft-btn" type="button" data-answer="once">Allow once</button>
          <button class="ft-btn is-primary" type="button" data-answer="always">Always allow</button>
        </footer>
      </div></div>`);
  private readonly what = q(this.root, '.ft-consent-what');
  private readonly effect = q(this.root, '.ft-consent-effect');
  private readonly reset = q(this.root, '.ft-consent-reset');
  private readonly buttons = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-answer]'));
  private current = '';
  private lastFocus: Element | null = null;
  private sending = false;

  constructor() {
    this.root.addEventListener('click', (e) => {
      const button = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-answer]') : null;
      if (button) void this.send(button.dataset.answer as 'deny' | 'once' | 'always');
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); void this.send('deny'); }
    });
    onAgentState((s) => this.apply(s));
  }

  get isOpen(): boolean { return !this.root.hidden; }

  private async send(answer: 'deny' | 'once' | 'always'): Promise<void> {
    if (!this.current || this.sending) return;
    this.sending = true;
    for (const b of this.buttons) setDisabled(b, true);
    try {
      const out = await api.agentAnswer(this.current, answer);
      if (answer === 'always' && !out.kept) toast('This computer has no system keychain, so the choice could not be kept. This one was allowed.', 'info', 6000);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The answer was not accepted.', 'error');
    } finally {
      this.sending = false;
      for (const b of this.buttons) setDisabled(b, false);
      void refreshAgentState();
    }
  }

  private apply(state: AgentState): void {
    const next = state.requests[0] ?? null;
    if (!next) {
      this.current = '';
      if (!this.root.hidden) {
        this.root.hidden = true;
        const back = this.lastFocus;
        this.lastFocus = null;
        if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true });
      }
      return;
    }
    this.current = next.id;
    setText(this.what, `An outside agent asks to run ${next.tool}.`);
    setText(this.effect, EFFECTS[next.effect] ?? '');
    setText(this.reset, state.notice);
    setHidden(this.reset, !state.notice);
    if (this.root.hidden) {
      this.lastFocus = document.activeElement;
      this.root.hidden = false;
      this.buttons[0].focus({ preventScroll: true });
    }
  }
}

const NOTES: Record<string, string> = {
  unavailable: 'No system keychain is available on this computer, so Allowed cannot be kept. formtools asks each time.',
};

export class OutsideAgentsRow {
  readonly el = el('<div class="ft-agent-access"></div>');
  private readonly row: Row<string>;
  private readonly note = el('<p class="cv-note ft-agent-note"></p>');
  private readonly status = el('<p class="cv-note ft-agent-status"></p>');

  constructor() {
    this.row = selectRow('Outside agents', [['ask', 'Ask each time'], ['allowed', 'Allowed'], ['blocked', 'Blocked']], (v) => void this.choose(v as AgentAccess), 'agentAccess');
    setText(this.note, 'Programs outside formtools, such as an AI agent or the command line, ask here before they change anything. Reading is always allowed. The agents inside formtools are not asked.');
    this.el.append(this.row.el, this.note, this.status);
    onAgentState((s) => this.apply(s));
  }

  private async choose(value: AgentAccess): Promise<void> {
    try {
      await api.agentSetAccess(value);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The choice was not saved.', 'error', 6000);
    }
    await refreshAgentState();
  }

  private apply(state: AgentState): void {
    this.row.set(state.access);
    setText(this.status, state.notice || NOTES[state.seal] || '');
  }
}
