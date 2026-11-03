import { COLOR_FORMATS, type ColorFormat } from '../../desk/color';
import { desk, type DeskCaps, type DeskTool, type ShortcutBinding } from '../../io/desk';

export type ShortcutId = DeskTool | 'topmost';

export const SHORTCUT_IDS: ShortcutId[] = ['picker', 'ruler', 'text', 'zoom', 'draw', 'timer', 'topmost'];

export const SHORTCUT_LABELS: Record<ShortcutId, string> = {
  picker: 'Colour picker', ruler: 'Screen ruler', text: 'Text extractor', zoom: 'Zoom', draw: 'Zoom and draw', timer: 'Break timer', topmost: 'Always on top',
};

export const DEFAULT_ACCEL: Record<ShortcutId, string> = {
  picker: 'CommandOrControl+Shift+Alt+C',
  ruler: 'CommandOrControl+Shift+Alt+M',
  text: 'CommandOrControl+Shift+Alt+T',
  zoom: 'CommandOrControl+Shift+Alt+Z',
  draw: 'CommandOrControl+Shift+Alt+D',
  timer: 'CommandOrControl+Shift+Alt+B',
  topmost: 'CommandOrControl+Shift+Alt+P',
};

export const ZOOM_STARTS = [1.25, 1.5, 2, 3, 4, 6, 8];

export interface DeskPrefsData {
  enabled: Record<ShortcutId, boolean>;
  accel: Record<ShortcutId, string>;
  format: ColorFormat;
  lang: string;
  timerMinutes: number;
  zoomStart: number;
}

export const PREFS_KEY = 'formtools_desk_prefs';

function defaults(): DeskPrefsData {
  const enabled = {} as Record<ShortcutId, boolean>;
  for (const id of SHORTCUT_IDS) enabled[id] = true;
  return { enabled, accel: { ...DEFAULT_ACCEL }, format: 'hex', lang: '', timerMinutes: 5, zoomStart: 2 };
}

const FORMATS = COLOR_FORMATS.map(([f]) => f as string);

function clean(raw: Partial<DeskPrefsData> | null): DeskPrefsData {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  for (const id of SHORTCUT_IDS) {
    const en = raw.enabled?.[id];
    if (typeof en === 'boolean') d.enabled[id] = en;
    const ac = raw.accel?.[id];
    if (typeof ac === 'string' && ac.length < 80) d.accel[id] = ac;
  }
  if (typeof raw.format === 'string' && FORMATS.includes(raw.format)) d.format = raw.format;
  if (typeof raw.lang === 'string' && /^[A-Za-z0-9_+-]{0,40}$/.test(raw.lang)) d.lang = raw.lang;
  if (typeof raw.timerMinutes === 'number' && Number.isFinite(raw.timerMinutes)) d.timerMinutes = Math.min(120, Math.max(1, Math.round(raw.timerMinutes)));
  if (typeof raw.zoomStart === 'number' && ZOOM_STARTS.includes(raw.zoomStart)) d.zoomStart = raw.zoomStart;
  return d;
}

const listeners = new Set<(p: DeskPrefsData) => void>();

export function loadDeskPrefs(): DeskPrefsData {
  let raw: Partial<DeskPrefsData> | null = null;
  try { raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') as Partial<DeskPrefsData> | null; } catch { raw = null; }
  return clean(raw);
}

export function saveDeskPrefs(next: DeskPrefsData): DeskPrefsData {
  const value = clean(next);
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(value)); } catch { return value; }
  for (const l of listeners) l(value);
  return value;
}

export function onDeskPrefs(fn: (p: DeskPrefsData) => void): void { listeners.add(fn); }

export function bindingsOf(p: DeskPrefsData): ShortcutBinding[] {
  const out: ShortcutBinding[] = [];
  for (const id of SHORTCUT_IDS) if (p.enabled[id] && p.accel[id]) out.push({ id, accel: p.accel[id] });
  return out;
}

export function loadList<T>(key: string, ok: (v: unknown) => v is T): T[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]') as unknown;
    return Array.isArray(raw) ? raw.filter(ok) : [];
  } catch { return []; }
}

export function saveList<T>(key: string, list: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { return; }
}

let capsPromise: Promise<DeskCaps | null> | null = null;
let capsError = '';

export function deskCaps(): Promise<DeskCaps | null> {
  if (!capsPromise) {
    capsPromise = desk.available()
      ? desk.caps().catch((e: unknown) => { capsError = e instanceof Error ? e.message : 'The desktop utilities did not answer.'; capsPromise = null; return null; })
      : Promise.resolve(null);
  }
  return capsPromise;
}

export const deskCapsError = (): string => capsError;

export function resetDeskCaps(): void { capsPromise = null; capsError = ''; }
