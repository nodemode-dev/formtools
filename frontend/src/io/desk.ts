import { inDesktop } from './host';

export type DeskTool = 'picker' | 'ruler' | 'text' | 'zoom' | 'draw' | 'timer';
export type DeskUtility = DeskTool | 'topmost' | 'awake' | 'hosts' | 'env';

export const DESK_TOOLS: DeskTool[] = ['picker', 'ruler', 'text', 'zoom', 'draw', 'timer'];
export const DESK_UTILITIES: DeskUtility[] = [...DESK_TOOLS, 'topmost', 'awake', 'hosts', 'env'];

export interface Support { ok: boolean; reason: string }

export interface DeskCaps {
  os: 'macos' | 'windows' | 'linux';
  session: 'x11' | 'wayland' | 'windows' | 'macos' | 'unknown';
  utilities: Record<DeskUtility, Support>;
  ocr: { engine: 'vision' | 'windows' | 'tesseract' | null; languages: string[] };
}

export interface Monitor { index: number; x: number; y: number; width: number; height: number; scale: number; path: string }
export interface Capture { id: string; monitors: Monitor[] }
export interface Rect { x: number; y: number; w: number; h: number }

export interface AwakeState { mode: 'off' | 'on' | 'timed'; display: boolean; until: number | null }
export interface AwakeRequest { mode: 'off' | 'on' | 'timed'; minutes?: number; display: boolean }
export interface TopmostResult { ok: boolean; on: boolean; title: string; error?: string }
export interface ShortcutBinding { id: string; accel: string }
export interface ShortcutResult { id: string; ok: boolean; error?: string }

export type DeskResultKind = 'colour' | 'measure' | 'text' | 'image' | 'cancel' | 'error';
export interface DeskResult { tool: DeskTool; kind: DeskResultKind; value: unknown }

export interface OverlayParams { tool: DeskTool; shot: string; monitor: number; scale: number; options: Record<string, unknown> }

export const RESULT_EVENT = 'desk://result';
export const SHORTCUT_EVENT = 'desk://shortcut';

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!inDesktop()) throw new Error('This works in the desktop app.');
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args);
}

export const desk = {
  available: inDesktop,
  caps: () => call<DeskCaps>('desk_capabilities'),
  start: (tool: DeskTool, options: Record<string, unknown> = {}) => call<Capture | null>('desk_start', { tool, options }),
  close: () => call<void>('desk_close'),
  ocr: (path: string, rect: Rect, lang: string | null = null) => call<{ text: string; engine: string }>('desk_ocr', { path, rect, lang }),
  awakeGet: () => call<AwakeState>('desk_awake_get'),
  awakeSet: (req: AwakeRequest) => call<AwakeState>('desk_awake_set', { req }),
  topmost: () => call<TopmostResult>('desk_topmost_toggle'),
  setShortcuts: (list: ShortcutBinding[]) => call<ShortcutResult[]>('desk_shortcuts_set', { list }),

  async onShortcut(handler: (id: string) => void): Promise<void> {
    if (!inDesktop()) return;
    const ev = await import('@tauri-apps/api/event');
    await ev.listen<string>(SHORTCUT_EVENT, (e) => { if (typeof e.payload === 'string') handler(e.payload); });
  },

  async onResult(handler: (r: DeskResult) => void): Promise<void> {
    if (!inDesktop()) return;
    const ev = await import('@tauri-apps/api/event');
    await ev.listen<DeskResult>(RESULT_EVENT, (e) => { if (e.payload && typeof e.payload === 'object') handler(e.payload); });
  },

  async emitResult(result: DeskResult): Promise<void> {
    if (!inDesktop()) return;
    const ev = await import('@tauri-apps/api/event');
    await ev.emit(RESULT_EVENT, result);
  },

  async copyText(text: string): Promise<void> {
    if (inDesktop()) {
      const cb = await import('@tauri-apps/plugin-clipboard-manager');
      await cb.writeText(text);
      return;
    }
    await navigator.clipboard.writeText(text);
  },

  async copyImage(png: Uint8Array): Promise<void> {
    const cb = await import('@tauri-apps/plugin-clipboard-manager');
    await cb.writeImage(png);
  },
};

export function overlayParams(search: string = location.search): OverlayParams {
  const p = new URLSearchParams(search);
  let options: Record<string, unknown> = {};
  try { options = JSON.parse(p.get('options') || '{}') as Record<string, unknown>; } catch { options = {}; }
  return {
    tool: (p.get('tool') || 'picker') as DeskTool,
    shot: p.get('shot') || '',
    monitor: Number(p.get('monitor') || 0),
    scale: Number(p.get('scale') || 1) || 1,
    options,
  };
}
