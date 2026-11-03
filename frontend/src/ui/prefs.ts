export interface Prefs {
  startPage: 'home' | 'browse';
  lastFolder: string;
  showHidden: boolean;
  thumbSize: number;
  browserView: 'grid' | 'list';
  sortBy: 'name' | 'date' | 'size' | 'type';
  sortDesc: boolean;
  viewerFit: 'fit' | 'fill' | 'actual';
  viewerBackground: 'theme' | 'black' | 'checker';
  prefetch: number;
  slideshowSeconds: number;
  smoothZoom: boolean;
  confirmTransform: boolean;
  recent: string[];
}

export const DEFAULT_PREFS: Prefs = {
  startPage: 'home',
  lastFolder: '',
  showHidden: false,
  thumbSize: 168,
  browserView: 'grid',
  sortBy: 'name',
  sortDesc: false,
  viewerFit: 'fit',
  viewerBackground: 'theme',
  prefetch: 2,
  slideshowSeconds: 4,
  smoothZoom: true,
  confirmTransform: false,
  recent: [],
};

const KEY = 'formtools.prefs';
const listeners = new Set<(p: Prefs) => void>();
let cache: Prefs | null = null;

const clamp = (n: unknown, lo: number, hi: number, d: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;

const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? v as T : d;

function clean(raw: Partial<Prefs>): Prefs {
  const d = DEFAULT_PREFS;
  return {
    startPage: pick(raw.startPage, ['home', 'browse'] as const, d.startPage),
    lastFolder: typeof raw.lastFolder === 'string' ? raw.lastFolder : d.lastFolder,
    showHidden: raw.showHidden === true,
    thumbSize: clamp(raw.thumbSize, 96, 320, d.thumbSize),
    browserView: pick(raw.browserView, ['grid', 'list'] as const, d.browserView),
    sortBy: pick(raw.sortBy, ['name', 'date', 'size', 'type'] as const, d.sortBy),
    sortDesc: raw.sortDesc === true,
    viewerFit: pick(raw.viewerFit, ['fit', 'fill', 'actual'] as const, d.viewerFit),
    viewerBackground: pick(raw.viewerBackground, ['theme', 'black', 'checker'] as const, d.viewerBackground),
    prefetch: clamp(raw.prefetch, 0, 6, d.prefetch),
    slideshowSeconds: clamp(raw.slideshowSeconds, 1, 60, d.slideshowSeconds),
    smoothZoom: raw.smoothZoom !== false,
    confirmTransform: raw.confirmTransform === true,
    recent: Array.isArray(raw.recent) ? raw.recent.filter((x): x is string => typeof x === 'string').slice(0, 24) : [],
  };
}

export function loadPrefs(): Prefs {
  if (cache) return cache;
  let raw: Partial<Prefs> = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Prefs>; } catch { raw = {}; }
  cache = clean(raw);
  return cache;
}

export function updatePrefs(change: Partial<Prefs>): Prefs {
  cache = clean({ ...loadPrefs(), ...change });
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { return cache; }
  for (const l of listeners) l(cache);
  return cache;
}

export function onPrefs(fn: (p: Prefs) => void): void { listeners.add(fn); }

export function addRecent(path: string): void {
  const list = [path, ...loadPrefs().recent.filter((p) => p !== path)].slice(0, 24);
  updatePrefs({ recent: list });
}
