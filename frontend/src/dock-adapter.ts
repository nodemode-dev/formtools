import type { ConsentChoice, ConsentRequest, DockAdapter, DockAgentStatus, DockChannel, DockChatEvent, DockProgramStatus, DockTerminal, StoredChoice, StoredChoiceState } from './dock/adapter';
import { api, ApiError, socketTo, type AgentRequest } from './io/api';
import { keyed, windowKey } from './io/window-key';
import { refreshAgentState } from './ui/agent-access';
import { isMac } from './ui/dom';
import { toast } from './ui/toast';

const EFFECTS: Record<AgentRequest['effect'], string> = {
  reads: 'It only looks at things.',
  adds: 'It adds new files and never replaces one that exists.',
  alters: 'It can delete, move or overwrite files.',
};
const PROGRAMS = ['claude', 'codex', 'cursor'] as const;
const adders: Array<(r: ConsentRequest) => void> = [];
const withdrawers: Array<(id: string) => void> = [];
const early = new Map<string, ConsentRequest>();
const shown = new Set<string>();

function platformMod(e: KeyboardEvent): boolean {
  return (isMac ? e.metaKey : e.ctrlKey) && e.code === 'KeyJ';
}

function asRequest(r: AgentRequest): ConsentRequest {
  const offers = (r.answers ?? ['deny', 'once', 'always']).filter((x): x is ConsentChoice => x === 'deny' || x === 'once' || x === 'always');
  return {
    id: r.id, agent: r.agentNamed ? r.agent ?? '' : '', what: r.what ?? `run ${r.tool}`, offers, always: r.alwaysScope === 'agent' ? 'agent' : 'all', escape: 'deny',
    notes: [EFFECTS[r.effect] ?? '', 'If nobody answers within two minutes the request is refused.'].filter((x) => x !== ''),
    ...(typeof r.expires === 'number' ? { expires: r.expires * 1000 } : {}),
  };
}

export const outsideAgents = {
  arrive(r: AgentRequest): void {
    if (shown.has(r.id)) return;
    shown.add(r.id);
    const request = asRequest(r);
    if (adders.length) for (const add of adders) add(request); else early.set(r.id, request);
  },
  gone(id: string): void {
    if (!shown.delete(id)) return;
    early.delete(id);
    for (const withdraw of withdrawers) withdraw(id);
  },
  async recover(): Promise<void> {
    const before = [...shown];
    let live: AgentRequest[];
    try { live = (await api.agentState()).requests; } catch { return; }
    for (const id of before) if (!live.some((r) => r.id === id)) outsideAgents.gone(id);
    for (const r of live) outsideAgents.arrive(r);
  },
  message(msg?: { t?: string; id?: string; request?: AgentRequest }): void {
    if (msg?.t === 'ask' && msg.request) outsideAgents.arrive(msg.request);
    else if (msg?.t === 'answered' && msg.id) outsideAgents.gone(msg.id);
    else void outsideAgents.recover();
    void refreshAgentState();
  },
  subscribe(add: (r: ConsentRequest) => void, withdraw: (id: string) => void): void {
    adders.push(add);
    withdrawers.push(withdraw);
    for (const r of early.values()) add(r);
    early.clear();
  },
  async answer(id: string, choice: ConsentChoice): Promise<void> {
    try {
      const out = await api.agentAnswer(id, choice);
      if (choice === 'always' && !out.kept) toast('This computer has no system keychain, so the choice could not be kept. This one was allowed.', 'info', 6000);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The answer was not accepted.', 'error');
    } finally {
      shown.delete(id);
      void refreshAgentState();
    }
  },
  async get(): Promise<StoredChoiceState> {
    const s = await refreshAgentState();
    return { value: s?.access ?? 'ask', changedOutside: s?.sealBroken === true };
  },
  async set(value: StoredChoice): Promise<void> {
    await api.agentSetAccess(value);
    await refreshAgentState();
  },
};

function socketChannel(socket: WebSocket): DockChannel {
  let data = (_chunk: string | Uint8Array): void => undefined;
  let exit = (): void => undefined;
  let closed = (): void => undefined;
  socket.binaryType = 'arraybuffer';
  socket.addEventListener('message', (msg) => {
    if (typeof msg.data === 'string') { data(msg.data); return; }
    try { if ((JSON.parse(new TextDecoder().decode(msg.data as ArrayBuffer)) as { type?: string }).type === 'exit') exit(); } catch { return; }
  });
  socket.addEventListener('close', () => closed());
  const send = (text: string): void => {
    if (socket.readyState === WebSocket.OPEN) socket.send(text);
    else if (socket.readyState === WebSocket.CONNECTING) socket.addEventListener('open', () => socket.send(text), { once: true });
  };
  return {
    send: (chunk) => send(JSON.stringify({ type: 'input', data: chunk })),
    resize: (cols, rows) => send(JSON.stringify({ type: 'resize', cols, rows })),
    onData: (handler) => { data = handler; },
    onExit: (handler) => { exit = handler; },
    onClose: (handler) => { closed = handler; },
    close: () => socket.close(),
  };
}

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string; detail?: unknown }) | null;
  if (!res.ok || body === null || body.ok === false) throw new ApiError(body?.error ?? (typeof body?.detail === 'string' ? body.detail : `The engine answered ${res.status}.`), res.status);
  return body;
}

export function formtoolsDock(openSettings: () => void): DockAdapter {
  return {
    words: {
      app: 'formtools', noun: 'files', start: './formtools', example: 'find the duplicates in this folder',
      lead: 'Ask Claude about your files in the line below: open a folder, convert or resize pictures, rename a batch, find duplicates, see what fills a disk. It works through formtools\'s commands, and every step shows here and in the window.',
    },
    placement: {
      mode: 'own',
      storage: { key: 'formtools.dock', legacy: ['formtools.terminal'] },
      sizes: { minHeight: 120, maxHeightShare: 0.7, defaultHeight: 280, minWidth: 320, maxWidthShare: 0.6, defaultWidth: 440 },
    },
    isDockChord: (e) => platformMod(e) && !e.shiftKey && !e.altKey,
    chordLabel: () => `${isMac ? 'Cmd' : 'Ctrl'}+J`,
    passKey: (e) => platformMod(e),
    tabs: () => ({ builtin: ['chat', 'shell', 'claude', 'codex', 'cursor'] }),
    classes: { iconButton: 'cv-tt-btn', button: 'cv-btn', primaryButton: 'cv-btn-primary', input: 'cv-input', select: 'cv-hf-sort', note: 'cv-note' },
    t: (_key, english) => english,
    onTheme: (handler) => { document.addEventListener('nm:ui-settings-changed', handler); },
    keyHeaders: (): Record<string, string> => {
      const key = windowKey();
      return key ? { 'X-Formtools-Window-Key': key } : {};
    },
    errors: {
      message: (err) => (err instanceof ApiError ? err.message : null),
      kind: (err) => {
        if (err instanceof TypeError) return 'unreachable';
        if (!(err instanceof ApiError)) return null;
        if (/not installed/i.test(err.message)) return 'notInstalled';
        if (err.status === 403) return 'refused';
        if (err.status === 404 || err.status === 405) return 'oldEngine';
        return err.status >= 500 ? 'unreachable' : null;
      },
    },
    terminal: {
      list: () => api.terminals(),
      open: async (kind, o) => {
        if (kind === 'shell') return api.openTerminal(o.cols, o.rows);
        if (kind === 'claude') return api.openClaude({ prompt: o.prompt, resume: o.resume, cols: o.cols, rows: o.rows });
        return readJson<DockTerminal>(await fetch('/api/terminal/agent', keyed({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, cols: o.cols, rows: o.rows }) })));
      },
      restart: (id) => api.restartTerminal(id),
      close: (id) => api.closeTerminal(id),
      channel: (id) => socketChannel(socketTo(`/terminal/${encodeURIComponent(id)}/stream`)),
    },
    agentStatus: async () => {
      let now: Partial<Record<string, Partial<DockProgramStatus>>>;
      try { now = await readJson<Partial<Record<string, Partial<DockProgramStatus>>>>(await fetch('/api/agents/status', keyed())); } catch { return null; }
      const out: DockAgentStatus = {};
      for (const name of PROGRAMS) {
        const p = now[name];
        if (p) out[name] = { installed: p.installed === true, version: p.version ?? null, install: p.install ?? '', signedIn: p.signedIn ?? null };
      }
      return out;
    },
    chat: {
      status: () => api.claudeStatus(),
      start: (mode, fresh) => api.claudeStart(mode ?? 'ask', fresh),
      send: (text) => api.claudeSend(text),
      stop: () => api.claudeStop(),
      answer: (id, allow) => api.claudeAllow(id, allow),
      modes: ['ask', 'auto-edits', 'plan'],
      subscribe: (handlers) => {
        const socket = socketTo('/agent/claude/stream');
        socket.addEventListener('open', () => handlers.open());
        socket.addEventListener('message', (msg) => { try { handlers.event(JSON.parse(String(msg.data)) as DockChatEvent); } catch { return; } });
        socket.addEventListener('close', () => handlers.close());
        return () => socket.close();
      },
    },
    consent: { subscribe: (add, withdraw) => outsideAgents.subscribe(add, withdraw), answer: (id, choice) => outsideAgents.answer(id, choice) },
    storedChoice: { get: () => outsideAgents.get(), set: (value) => outsideAgents.set(value) },
    openSettings,
  };
}
