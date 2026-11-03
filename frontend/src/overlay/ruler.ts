import { icon } from '../ui/icons';
import { el, q, setClass, setStyleVar, setText } from '../ui/dom';
import type { ToolMount } from './ctx';
import { frameLoop, place } from './stage';

type Mode = 1 | 2 | 3 | 4;
const MODES: Array<[Mode, string, string, string]> = [
  [1, 'bounds', 'tMarquee', 'Bounds'],
  [2, 'spacing', 'tMove', 'Spacing'],
  [3, 'horizontal', 'tRowMarquee', 'Horizontal'],
  [4, 'vertical', 'tColMarquee', 'Vertical'],
];
const GAP = 18;

interface Extent { l: number; r: number; u: number; d: number }

export const mountRuler: ToolMount = (ctx) => {
  const { stage, params, hint } = ctx;
  const asked = Number(params.options.tolerance);
  let tol = Number.isFinite(asked) && params.options.tolerance !== undefined ? Math.min(255, Math.max(0, Math.round(asked))) : 30;
  let mode: Mode = 2;
  let px = Math.floor(stage.width / 2);
  let py = Math.floor(stage.height / 2);
  let drag: { x: number; y: number } | null = null;
  let active = false;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#f97316';

  const layer = stage.addLayer('ov-over');
  const g = layer.getContext('2d');

  const bar = el<HTMLElement>(`<div class="ov-modes">${MODES.map(([m, , ic, label]) => `<button type="button" class="ov-mode" data-mode="${m}">${icon(ic, 14)}<span>${label}</span><kbd>${m}</kbd></button>`).join('')}<span class="ov-modes-tol"></span></div>`);
  const tolLabel = q(bar, '.ov-modes-tol');
  const read = el<HTMLElement>('<div class="ov-read is-idle"></div>');
  stage.root.append(bar, read);
  const buttons = Array.from(bar.querySelectorAll<HTMLElement>('.ov-mode'));

  const near = (i: number, j: number): boolean => {
    const o = i * 4, p = j * 4, d = stage.pixels;
    return Math.abs(d[o] - d[p]) <= tol && Math.abs(d[o + 1] - d[p + 1]) <= tol && Math.abs(d[o + 2] - d[p + 2]) <= tol;
  };

  const scan = (): Extent => {
    const w = stage.width, h = stage.height;
    const origin = py * w + px;
    let l = 0, r = 0, u = 0, d = 0;
    while (px - l - 1 >= 0 && near(origin, py * w + px - l - 1)) l++;
    while (px + r + 1 < w && near(origin, py * w + px + r + 1)) r++;
    while (py - u - 1 >= 0 && near(origin, (py - u - 1) * w + px)) u++;
    while (py + d + 1 < h && near(origin, (py + d + 1) * w + px)) d++;
    return { l, r, u, d };
  };

  interface Measure { mode: string; width: number | null; height: number | null; length: number | null; text: string; rect: { x: number; y: number; w: number; h: number } }

  const measure = (): Measure => {
    if (mode === 1) {
      const x0 = drag ? Math.min(drag.x, px) : px;
      const y0 = drag ? Math.min(drag.y, py) : py;
      const w = drag ? Math.abs(drag.x - px) + 1 : 1;
      const h = drag ? Math.abs(drag.y - py) + 1 : 1;
      return { mode: 'bounds', width: w, height: h, length: null, text: `${w} x ${h}`, rect: { x: x0, y: y0, w, h } };
    }
    const e = scan();
    const w = e.l + e.r + 1, h = e.u + e.d + 1;
    if (mode === 2) return { mode: 'spacing', width: w, height: h, length: null, text: `${w} x ${h}`, rect: { x: px - e.l, y: py - e.u, w, h } };
    if (mode === 3) return { mode: 'horizontal', width: null, height: null, length: w, text: `${w}`, rect: { x: px - e.l, y: py, w, h: 1 } };
    return { mode: 'vertical', width: null, height: null, length: h, text: `${h}`, rect: { x: px, y: py - e.u, w: 1, h } };
  };

  const stroke = (draw: () => void): void => {
    if (!g) return;
    g.lineCap = 'butt';
    g.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    g.lineWidth = 3;
    g.beginPath();
    draw();
    g.stroke();
    g.strokeStyle = accent;
    g.lineWidth = 1;
    g.beginPath();
    draw();
    g.stroke();
  };

  const redraw = frameLoop(() => {
    if (!g) return;
    g.clearRect(0, 0, layer.width, layer.height);
    const m = measure();
    const { x, y, w, h } = m.rect;
    const tick = 6;
    if (mode === 1) {
      if (drag) {
        g.fillStyle = 'rgba(255, 255, 255, 0.08)';
        g.fillRect(x, y, w, h);
        stroke(() => g.rect(x + 0.5, y + 0.5, w - 1, h - 1));
      }
    } else {
      if (mode !== 4) {
        stroke(() => {
          g.moveTo(x, py + 0.5); g.lineTo(x + w, py + 0.5);
          g.moveTo(x + 0.5, py - tick); g.lineTo(x + 0.5, py + tick + 1);
          g.moveTo(x + w - 0.5, py - tick); g.lineTo(x + w - 0.5, py + tick + 1);
        });
      }
      if (mode !== 3) {
        stroke(() => {
          g.moveTo(px + 0.5, y); g.lineTo(px + 0.5, y + h);
          g.moveTo(px - tick, y + 0.5); g.lineTo(px + tick + 1, y + 0.5);
          g.moveTo(px - tick, y + h - 0.5); g.lineTo(px + tick + 1, y + h - 0.5);
        });
      }
    }
    const label = mode === 1 && !drag ? '' : m.text;
    setText(read, label);
    setClass(read, 'is-idle', !active || label === '');
    const cx = (px + 0.5) / stage.sx;
    const cy = (py + 0.5) / stage.sy;
    const rw = label.length * 8 + 20;
    place(read, cx + GAP + rw > innerWidth ? cx - GAP - rw : cx + GAP, cy + GAP + 28 > innerHeight ? cy - GAP - 28 : cy + GAP);
    buttons.forEach((b) => setClass(b, 'is-on', Number(b.dataset.mode) === mode));
    setText(tolLabel, mode === 1 ? '' : `tolerance ${tol}`);
    setStyleVar(read, '--read-w', `${rw}px`);
  });

  const setMode = (m: Mode): void => {
    mode = m;
    drag = null;
    redraw();
  };

  const done = (): void => {
    const m = measure();
    void ctx.finish({ tool: 'ruler', kind: 'measure', value: m }, { text: m.text });
  };

  const move = (e: PointerEvent): void => {
    px = Math.min(stage.width - 1, Math.max(0, Math.floor(e.clientX * stage.sx)));
    py = Math.min(stage.height - 1, Math.max(0, Math.floor(e.clientY * stage.sy)));
    active = true;
    redraw();
  };

  const ac = new AbortController();
  const on = { signal: ac.signal };

  bar.addEventListener('pointerdown', (e) => e.stopPropagation(), on);
  bar.addEventListener('pointerup', (e) => e.stopPropagation(), on);
  bar.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = (e.target as HTMLElement).closest<HTMLElement>('.ov-mode');
    if (b) setMode(Number(b.dataset.mode) as Mode);
  }, on);

  stage.root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    move(e);
    if (mode === 1) {
      drag = { x: px, y: py };
      stage.root.setPointerCapture(e.pointerId);
      redraw();
    }
  }, on);

  window.addEventListener('pointermove', move, on);

  stage.root.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    move(e);
    if (mode === 1) {
      if (!drag) return;
      done();
      drag = null;
      redraw();
    } else {
      done();
    }
  }, on);

  window.addEventListener('wheel', (e) => {
    if (mode === 1) return;
    e.preventDefault();
    tol = Math.min(255, Math.max(0, tol + (e.deltaY < 0 ? 5 : -5)));
    redraw();
  }, { signal: ac.signal, passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { void ctx.cancel(); return; }
    if (e.key >= '1' && e.key <= '4') { setMode(Number(e.key) as Mode); return; }
    const step = e.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'Enter') { e.preventDefault(); if (mode !== 1) done(); return; }
    else return;
    e.preventDefault();
    px = Math.min(stage.width - 1, Math.max(0, px + dx));
    py = Math.min(stage.height - 1, Math.max(0, py + dy));
    active = true;
    redraw();
  }, on);

  hint.set([['1-4', 'bounds, spacing, horizontal, vertical'], ['Click', 'copy size'], ['Wheel', 'tolerance'], ['Arrows', 'move 1 px'], ['Esc', 'close']]);
  redraw();

  return () => {
    ac.abort();
    layer.remove();
    bar.remove();
    read.remove();
  };
};
