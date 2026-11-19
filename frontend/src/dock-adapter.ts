import type { DockAdapter, DockAgentStatus, DockTerminal } from './dock/adapter';
import { api, ApiError, socketTo } from './io/api';
import { keyed, windowKey } from './io/window-key';
import { isMac } from './ui/dom';

const OWN: Record<string, string> = {
  lead: 'Ask Claude about your files in the line below: open a folder, convert or resize pictures, rename a batch, find duplicates, see what fills a disk. It works through formtools\'s commands, and every step shows here and in the window.',
};

function toggleKey(e: KeyboardEvent): boolean {
  return (isMac ? e.metaKey : e.ctrlKey) && e.code === 'KeyJ';
}

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string; detail?: unknown }) | null;
  if (!res.ok || body === null || body.ok === false) throw new ApiError(body?.error ?? (typeof body?.detail === 'string' ? body.detail : `The engine answered ${res.status}.`), res.status);
  return body;
}

export function formtoolsDock(shell: HTMLElement, status: HTMLElement): DockAdapter {
  return {
    app: { name: 'formtools', noun: 'files', start: './formtools', examples: 'open a folder, convert or resize pictures, rename a batch, find duplicates, see what fills a disk' },
    storage: { key: 'formtools.dock', legacy: ['formtools.terminal'] },
    sizes: { minHeight: 120, maxHeightShare: 0.7, defaultHeight: 280, minWidth: 320, maxWidthShare: 0.6, defaultWidth: 440 },
    shortcut: { code: 'KeyJ', label: `${isMac ? 'Cmd' : 'Ctrl'}+J` },
    tabs: ['chat', 'shell', 'claude', 'codex', 'cursor'],
    classes: { iconButton: 'cv-tt-btn', button: 'cv-btn', primaryButton: 'cv-btn-primary', input: 'cv-input', select: 'cv-hf-sort', note: 'cv-note' },
    mount: (dock) => {
      shell.insertBefore(dock, status);
      dock.querySelector('.ft-dock-stage')?.addEventListener('keydown', (e) => { if (!toggleKey(e as KeyboardEvent)) e.stopPropagation(); });
      const grip = dock.querySelector('.ft-dock-grip');
      grip?.addEventListener('pointerdown', () => grip.classList.add('is-dragging'));
      for (const end of ['pointerup', 'pointercancel']) grip?.addEventListener(end, () => grip.classList.remove('is-dragging'));
    },
    t: (key, english) => OWN[key] ?? english,
    onTheme: (handler) => { document.addEventListener('nm:ui-settings-changed', handler); },
    keyHeaders: (): Record<string, string> => {
      const key = windowKey();
      return key ? { 'X-Formtools-Window-Key': key } : {};
    },
    errors: {
      message: (err) => (err instanceof ApiError ? err.message : null),
      missingRoute: (err) => err instanceof ApiError && (err.status === 404 || err.status === 405),
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
      socket: (id) => socketTo(`/terminal/${encodeURIComponent(id)}/stream`),
    },
    agentStatus: async () => {
      const claude = await api.claudeCodeStatus();
      let others: DockAgentStatus = {};
      try { others = (await readJson<{ agents?: DockAgentStatus }>(await fetch('/api/claude-code/status', keyed()))).agents ?? {}; } catch { others = {}; }
      return claude || others.codex || others.cursor ? { ...others, ...(claude ? { claude } : {}) } : null;
    },
    chat: {
      status: () => api.claudeStatus(),
      start: (mode, fresh) => api.claudeStart(mode, fresh),
      send: (text) => api.claudeSend(text),
      stop: () => api.claudeStop(),
      answer: (id, allow) => api.claudeAllow(id, allow),
      socket: () => socketTo('/agent/claude/stream'),
    },
  };
}
