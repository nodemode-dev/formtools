import { setClass } from './dom';
import { readChoice, setTheme, THEMES } from './themes';

export type UiFontSize = 'small' | 'default' | 'large' | 'larger';
export const UI_FONT_SIZES: ReadonlyArray<readonly [UiFontSize, string]> = [['small', 'Small'], ['default', 'Default'], ['large', 'Large'], ['larger', 'Larger']];
export const UI_FONT_SCALE: Record<UiFontSize, number> = { small: 0.9, default: 1, large: 1.15, larger: 1.3 };

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
  uiFontSize: UiFontSize;
  animations: boolean;
  themeAuto: boolean;
  themeLight: string;
  themeDark: string;
  favouriteThemes: string[];
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
  uiFontSize: 'default',
  animations: true,
  themeAuto: false,
  themeLight: 'light',
  themeDark: 'studio',
  favouriteThemes: [],
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
    uiFontSize: pick(raw.uiFontSize, UI_FONT_SIZES.map(([k]) => k), d.uiFontSize),
    animations: raw.animations !== false,
    themeAuto: raw.themeAuto === true,
    themeLight: typeof raw.themeLight === 'string' && THEMES[raw.themeLight]?.light ? raw.themeLight : d.themeLight,
    themeDark: typeof raw.themeDark === 'string' && THEMES[raw.themeDark] && !THEMES[raw.themeDark].light ? raw.themeDark : d.themeDark,
    favouriteThemes: Array.isArray(raw.favouriteThemes) ? Array.from(new Set(raw.favouriteThemes.filter((x): x is string => typeof x === 'string' && !!THEMES[x]))).slice(0, 30) : [],
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

let sizedK = 0;
let pxFontSheet: HTMLStyleElement | null = null;
let pxFontFactor = 1;

function scalePxFonts(k: number): void {
  if (k === pxFontFactor) return;
  pxFontFactor = k;
  if (!pxFontSheet) {
    if (k === 1) return;
    pxFontSheet = document.createElement('style');
    pxFontSheet.dataset.role = 'ui-font-scale';
    document.head.appendChild(pxFontSheet);
  }
  const walk = (rules: CSSRuleList): string => {
    let out = '';
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule) {
        const m = /^(\d+(?:\.\d+)?)px$/.exec(r.style.getPropertyValue('font-size'));
        if (m && r.selectorText) out += `${r.selectorText}{font-size:${Math.round(parseFloat(m[1]) * k * 10) / 10}px}`;
      } else if (r instanceof CSSMediaRule) {
        const inner = walk(r.cssRules);
        if (inner) out += `@media ${r.media.mediaText}{${inner}}`;
      } else if (r instanceof CSSSupportsRule) {
        const inner = walk(r.cssRules);
        if (inner) out += `@supports ${r.conditionText}{${inner}}`;
      }
    }
    return out;
  };
  let css = '';
  if (k !== 1) {
    for (const sheet of Array.from(document.styleSheets)) {
      if (sheet.ownerNode === pxFontSheet) continue;
      try { css += walk(sheet.cssRules); } catch { continue; }
    }
  }
  pxFontSheet.textContent = css;
}

export function applyUiFontSize(p: Prefs): void {
  const k = UI_FONT_SCALE[p.uiFontSize];
  if (k === sizedK) return;
  const s = document.documentElement.style;
  for (const n of [9, 10, 11, 12, 13, 14, 16, 18]) {
    if (k === 1) s.removeProperty(`--fs-${n}`);
    else s.setProperty(`--fs-${n}`, `${Math.round(n * k * 10) / 10}px`);
  }
  scalePxFonts(k);
  const first = sizedK === 0;
  sizedK = k;
  if (!first) document.dispatchEvent(new CustomEvent('nm:ui-settings-changed', { detail: { key: 'fontSize' } }));
}

let systemScheme: MediaQueryList | null = null;
let systemSchemeOn: (() => void) | null = null;

function followSystemTheme(p: Prefs): void {
  if (typeof matchMedia !== 'function') return;
  if (!systemScheme) systemScheme = matchMedia('(prefers-color-scheme: dark)');
  if (systemSchemeOn) {
    systemScheme.removeEventListener('change', systemSchemeOn);
    systemSchemeOn = null;
  }
  if (!p.themeAuto) return;
  const pickTheme = (): void => {
    const id = systemScheme?.matches ? p.themeDark : p.themeLight;
    if (readChoice().theme !== id) setTheme(id);
  };
  systemSchemeOn = pickTheme;
  systemScheme.addEventListener('change', pickTheme);
  pickTheme();
}

export function applyUiPrefs(p: Prefs = loadPrefs()): void {
  setClass(document.body, 'animations-disabled', !p.animations);
  applyUiFontSize(p);
  followSystemTheme(p);
}

onPrefs((p) => applyUiPrefs(p));

export function addRecent(path: string): void {
  const list = [path, ...loadPrefs().recent.filter((p) => p !== path)].slice(0, 24);
  updatePrefs({ recent: list });
}
