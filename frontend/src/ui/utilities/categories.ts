import type { UsageCategory, UsageNode } from '../../io/util-api';

export const CATEGORIES: Array<{ id: UsageCategory; label: string }> = [
  { id: 'images', label: 'Images' },
  { id: 'raw', label: 'Raw photos' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'documents', label: 'Documents' },
  { id: 'code', label: 'Code' },
  { id: 'data', label: 'Data' },
  { id: 'archives', label: 'Archives' },
  { id: '3d', label: '3D models' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'apps', label: 'Apps and binaries' },
  { id: 'system', label: 'System and caches' },
  { id: 'other', label: 'Other' },
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<UsageCategory, string>;
export const CATEGORY_INDEX = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i])) as Record<UsageCategory, number>;

export type Rgb = [number, number, number];

export interface Palette { colors: Rgb[]; background: Rgb; text: Rgb; font: string }

let scratch: CanvasRenderingContext2D | null = null;

function parseColor(css: string, fallback: Rgb): Rgb {
  if (!css) return fallback;
  scratch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!scratch) return fallback;
  scratch.clearRect(0, 0, 1, 1);
  scratch.fillStyle = '#000000';
  scratch.fillStyle = css;
  scratch.fillRect(0, 0, 1, 1);
  const d = scratch.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

export function readPalette(host: Element): Palette {
  const cs = getComputedStyle(host);
  const colors = CATEGORIES.map((c) => parseColor(cs.getPropertyValue(`--ft-cat-${c.id}`).trim(), [128, 128, 128]));
  return {
    colors,
    background: parseColor(cs.getPropertyValue('--bg-primary').trim(), [17, 17, 17]),
    text: parseColor(cs.getPropertyValue('--text-primary').trim(), [247, 247, 247]),
    font: cs.fontFamily || 'sans-serif',
  };
}

export function dominant(types: UsageNode['types'] | undefined): UsageCategory | null {
  if (!types) return null;
  let best: UsageCategory | null = null;
  let max = 0;
  for (const c of CATEGORIES) {
    const v = types[c.id] ?? 0;
    if (v > max) { max = v; best = c.id; }
  }
  return best;
}

export function nodeCategory(n: UsageNode): UsageCategory {
  return n.category ?? dominant(n.types) ?? 'other';
}

export function typeGradient(types: UsageNode['types'] | undefined, total: number): string {
  if (!types || total <= 0) return 'none';
  const stops: string[] = [];
  let at = 0;
  for (const c of CATEGORIES) {
    const v = types[c.id] ?? 0;
    if (v <= 0) continue;
    const next = Math.min(100, at + (v / total) * 100);
    stops.push(`var(--ft-cat-${c.id}) ${at.toFixed(2)}% ${next.toFixed(2)}%`);
    at = next;
  }
  return stops.length ? `linear-gradient(90deg, ${stops.join(', ')})` : 'none';
}

export const pct = (part: number, whole: number): string => {
  if (whole <= 0) return '0%';
  const v = (part / whole) * 100;
  return v > 0 && v < 0.1 ? '<0.1%' : `${v.toFixed(v >= 10 ? 0 : 1)}%`;
};
