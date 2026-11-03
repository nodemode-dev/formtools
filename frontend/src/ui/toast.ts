import { el, setText } from './dom';
import { icon } from './icons';

const MAX = 1;
const pool: HTMLElement[] = [];

export function toast(text: string, kind: 'info' | 'error' = 'info', ms = 3200): void {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const make = (): HTMLElement => el<HTMLElement>(`<div class="cv-toast" role="status" hidden><span class="cv-toast-icon"></span><span class="cv-toast-text"></span></div>`);
  let node = pool.find((n) => n.hidden && n.querySelector('.cv-toast-text')?.textContent === text) ?? pool.find((n) => n.hidden);
  if (node && node.querySelector('.cv-toast-text')?.textContent !== text) {
    const fresh = make();
    node.replaceWith(fresh);
    pool[pool.indexOf(node)] = fresh;
    node = fresh;
  }
  if (!node) {
    if (pool.length >= MAX) {
      const old = pool[0];
      window.clearTimeout(Number(old.dataset.timer || 0));
      node = make();
      old.replaceWith(node);
      pool[0] = node;
    } else {
      node = make();
      root.appendChild(node);
      pool.push(node);
    }
  }
  const n = node;
  n.dataset.kind = kind;
  n.querySelector('.cv-toast-icon')!.innerHTML = icon(kind === 'error' ? 'warning' : 'info', 14);
  setText(n.querySelector('.cv-toast-text'), text);
  n.hidden = false;
  window.clearTimeout(Number(n.dataset.timer || 0));
  n.dataset.timer = String(window.setTimeout(() => { n.hidden = true; }, ms));
}
