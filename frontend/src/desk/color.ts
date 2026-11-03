export interface Rgb { r: number; g: number; b: number }

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'hsv' | 'hwb' | 'cmyk' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'decimal' | 'float';

export const COLOR_FORMATS: Array<[ColorFormat, string]> = [
  ['hex', 'HEX'], ['rgb', 'RGB'], ['hsl', 'HSL'], ['hsv', 'HSV'], ['hwb', 'HWB'], ['cmyk', 'CMYK'],
  ['lab', 'CIE Lab'], ['lch', 'CIE LCh'], ['oklab', 'OKLab'], ['oklch', 'OKLCH'], ['decimal', 'Decimal'], ['float', 'Float'],
];

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 0): number => { const k = 10 ** d; return Math.round(v * k) / k; };
const hex2 = (v: number): string => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');

export function parseHex(s: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export const toHex = (c: Rgb): string => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;

const linear = (v: number): number => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };

function hue(c: Rgb): { h: number; max: number; min: number } {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, max, min };
}

export function toHsl(c: Rgb): [number, number, number] {
  const { h, max, min } = hue(c);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return [h, s * 100, l * 100];
}

export function toHsv(c: Rgb): [number, number, number] {
  const { h, max, min } = hue(c);
  return [h, max ? ((max - min) / max) * 100 : 0, max * 100];
}

export function toHwb(c: Rgb): [number, number, number] {
  const { h, max, min } = hue(c);
  return [h, min * 100, (1 - max) * 100];
}

export function toCmyk(c: Rgb): [number, number, number, number] {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  return [((1 - r - k) / (1 - k)) * 100, ((1 - g - k) / (1 - k)) * 100, ((1 - b - k) / (1 - k)) * 100, k * 100];
}

export function toLab(c: Rgb): [number, number, number] {
  const r = linear(c.r), g = linear(c.g), b = linear(c.b);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function toOklab(c: Rgb): [number, number, number] {
  const r = linear(c.r), g = linear(c.g), b = linear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const polar = (a: number, b: number): [number, number] => {
  const ch = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [ch, ch < 1e-4 ? 0 : h];
};

export function formatColor(c: Rgb, f: ColorFormat): string {
  switch (f) {
    case 'hex': return toHex(c).toUpperCase();
    case 'rgb': return `rgb(${c.r}, ${c.g}, ${c.b})`;
    case 'hsl': { const [h, s, l] = toHsl(c); return `hsl(${round(h)} ${round(s)}% ${round(l)}%)`; }
    case 'hsv': { const [h, s, v] = toHsv(c); return `hsv(${round(h)} ${round(s)}% ${round(v)}%)`; }
    case 'hwb': { const [h, w, b] = toHwb(c); return `hwb(${round(h)} ${round(w)}% ${round(b)}%)`; }
    case 'cmyk': { const [cy, m, y, k] = toCmyk(c); return `cmyk(${round(cy)}% ${round(m)}% ${round(y)}% ${round(k)}%)`; }
    case 'lab': { const [l, a, b] = toLab(c); return `lab(${round(l, 2)}% ${round(a, 2)} ${round(b, 2)})`; }
    case 'lch': { const [l, a, b] = toLab(c); const [ch, h] = polar(a, b); return `lch(${round(l, 2)}% ${round(ch, 2)} ${round(h, 1)})`; }
    case 'oklab': { const [l, a, b] = toOklab(c); return `oklab(${round(l * 100, 2)}% ${round(a, 4)} ${round(b, 4)})`; }
    case 'oklch': { const [l, a, b] = toOklab(c); const [ch, h] = polar(a, b); return `oklch(${round(l * 100, 2)}% ${round(ch, 4)} ${round(h, 1)})`; }
    case 'decimal': return String(c.r * 65536 + c.g * 256 + c.b);
    case 'float': return `${round(c.r / 255, 3)}, ${round(c.g / 255, 3)}, ${round(c.b / 255, 3)}`;
  }
}

export function contrastText(c: Rgb): '#000000' | '#ffffff' {
  const y = 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
  return y > 0.179 ? '#000000' : '#ffffff';
}
