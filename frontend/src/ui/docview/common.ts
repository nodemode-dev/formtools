import { delayedIndicator, type Disposer } from '../dom';

export const fmtInt = (n: number): string => n.toLocaleString('en-US');

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function fmtDate(sec: number): string {
  if (!sec) return '';
  const d = new Date(sec * 1000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export function busy(spinner: HTMLElement): Disposer {
  return delayedIndicator(() => spinner.classList.add('is-on'), () => spinner.classList.remove('is-on'));
}

export class Seq {
  private n = 0;
  next(): number { return ++this.n; }
  bump(): void { this.n++; }
  is(v: number): boolean { return v === this.n; }
}

export const errText = (e: unknown): string => (e instanceof Error ? e.message : 'Something went wrong.');

export const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p;
export const dirName = (p: string): string => {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i <= 0 ? p.slice(0, Math.max(i, 0)) || '/' : p.slice(0, i);
};

export function typeOnly(e: KeyboardEvent): boolean {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);
}
