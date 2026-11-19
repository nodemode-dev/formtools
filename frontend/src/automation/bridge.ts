import type { Commands } from '../ui/commands';
import type { AgentRequest } from '../io/api';
import { windowKey } from '../io/window-key';
import { asAgent } from './actor';
import { mirrorCatalogue } from './catalogue';

const WINDOW_ONLY = new Set(['terminal-toggle', 'terminal-new', 'claude-code', 'claude-chat']);

function safe(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

async function runOne(commands: Commands, id: string, params: Record<string, unknown>): Promise<unknown> {
  if (WINDOW_ONLY.has(id)) throw new Error(`${id} runs only from the formtools window.`);
  const out = commands.run(id, params);
  if (!out.ok) throw new Error(out.error ?? 'The command failed.');
  return await out.result;
}

export function connectBridge(commands: Commands, onConsent: (msg?: { t?: string; id?: string; request?: AgentRequest }) => void = () => undefined): void {
  let delay = 500;
  const open = (): void => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/live`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'hello', key: windowKey() }));
      delay = 500;
      void mirrorCatalogue(commands).catch(() => undefined);
      onConsent();
    };
    ws.onmessage = async (ev) => {
      let msg: { t?: string; id?: string; command?: string; params?: Record<string, unknown>; request?: AgentRequest };
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.t === 'ask' || msg.t === 'answered') { onConsent(msg); return; }
      if (msg.t !== 'run' || !msg.id || !msg.command) return;
      try {
        const result = await asAgent(() => runOne(commands, msg.command!, msg.params ?? {}));
        ws.send(JSON.stringify({ t: 'result', id: msg.id, ok: true, result: safe(result) }));
      } catch (e) {
        ws.send(JSON.stringify({ t: 'result', id: msg.id, ok: false, error: (e as Error).message }));
      }
    };
    ws.onclose = () => { window.setTimeout(open, delay); delay = Math.min(delay * 2, 10000); };
  };
  open();
}
