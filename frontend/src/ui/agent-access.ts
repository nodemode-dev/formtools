import { api, type AgentAccess, type AgentState } from '../io/api';
import { el, setText } from './dom';
import { toast } from './toast';
import { selectRow, type Row } from './settings/rows';

type Listener = (state: AgentState) => void;

const listeners = new Set<Listener>();
let last: AgentState | null = null;
let inflight: Promise<AgentState | null> | null = null;

export function refreshAgentState(): Promise<AgentState | null> {
  if (inflight) return inflight;
  inflight = api.agentState().then((s) => { last = s; for (const fn of listeners) fn(s); return s; }, () => last).finally(() => { inflight = null; });
  return inflight;
}

export function onAgentState(fn: Listener): void {
  listeners.add(fn);
  if (last) fn(last);
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
    setText(this.note, 'Programs outside formtools, such as an AI agent or the command line, ask in the window before they change anything. Always allow in that question sets this to Allowed, for every outside agent and not only the one that asked. Blocked also stops the Chat, Claude Code, Codex and Cursor tabs inside formtools from changing anything; under Ask each time and Allowed those tabs are not asked. Reading is always allowed.');
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
