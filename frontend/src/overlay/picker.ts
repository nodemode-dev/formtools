import { COLOR_FORMATS, formatColor, toHex, type ColorFormat } from '../desk/color';
import { el, q, setClass, setStyleVar, setText } from '../ui/dom';
import type { ToolMount } from './ctx';
import { frameLoop, place } from './stage';

const GRID = 15;
const CELL = 10;
const MAP = GRID * CELL;
const READ_H = 52;
const GAP = 22;
const HALF = (GRID - 1) / 2;

export const mountPicker: ToolMount = (ctx) => {
  const { stage, params, hint } = ctx;
  const asked = params.options.format;
  const format: ColorFormat = COLOR_FORMATS.some(([f]) => f === asked) ? (asked as ColorFormat) : 'hex';
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cell = Math.round(CELL * dpr);

  const loupe = el<HTMLElement>('<div class="ov-loupe is-idle"><canvas class="ov-loupe-map"></canvas><div class="ov-loupe-read"><i class="ov-swatch"></i><span class="ov-loupe-val"></span><span class="ov-loupe-pos"></span></div></div>');
  const map = q<HTMLCanvasElement>(loupe, '.ov-loupe-map');
  const val = q(loupe, '.ov-loupe-val');
  const pos = q(loupe, '.ov-loupe-pos');
  map.width = cell * GRID;
  map.height = cell * GRID;
  stage.root.append(loupe);

  const mg = map.getContext('2d');
  const small = document.createElement('canvas');
  small.width = GRID;
  small.height = GRID;
  const sg = small.getContext('2d');
  const cells = new ImageData(GRID, GRID);

  let px = Math.floor(stage.width / 2);
  let py = Math.floor(stage.height / 2);
  let active = false;
  let lastText = '';

  const redraw = frameLoop(() => {
    if (!mg || !sg) return;
    const d = cells.data;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const o = (j * GRID + i) * 4;
        const c = stage.rgbAt(px - HALF + i, py - HALF + j);
        d[o] = c ? c.r : 20;
        d[o + 1] = c ? c.g : 20;
        d[o + 2] = c ? c.b : 20;
        d[o + 3] = 255;
      }
    }
    sg.putImageData(cells, 0, 0);
    mg.imageSmoothingEnabled = false;
    mg.drawImage(small, 0, 0, map.width, map.height);
    mg.lineWidth = 1;
    mg.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    mg.beginPath();
    for (let i = 1; i < GRID; i++) {
      mg.moveTo(i * cell + 0.5, 0);
      mg.lineTo(i * cell + 0.5, map.height);
      mg.moveTo(0, i * cell + 0.5);
      mg.lineTo(map.width, i * cell + 0.5);
    }
    mg.stroke();
    mg.strokeStyle = '#000000';
    mg.lineWidth = 3;
    mg.strokeRect(HALF * cell + 1.5, HALF * cell + 1.5, cell - 3, cell - 3);
    mg.strokeStyle = '#ffffff';
    mg.lineWidth = 1;
    mg.strokeRect(HALF * cell + 1.5, HALF * cell + 1.5, cell - 3, cell - 3);

    const rgb = stage.rgbAt(px, py);
    lastText = rgb ? formatColor(rgb, format) : '';
    setText(val, lastText);
    setText(pos, `${px}, ${py}`);
    if (rgb) setStyleVar(loupe, '--swatch', toHex(rgb));
    const w = Math.max(MAP, lastText.length * 7 + 56);
    setStyleVar(loupe, '--loupe-w', `${w}px`);
    const cx = (px + 0.5) / stage.sx;
    const cy = (py + 0.5) / stage.sy;
    const h = MAP + READ_H;
    let left = cx + GAP;
    if (left + w > innerWidth) left = cx - GAP - w;
    let top = cy + GAP;
    if (top + h > innerHeight) top = cy - GAP - h;
    place(loupe, Math.max(0, left), Math.max(0, top));
    setClass(loupe, 'is-idle', !active);
  });

  const pick = (): void => {
    const rgb = stage.rgbAt(px, py);
    if (!rgb) return;
    const text = formatColor(rgb, format);
    void ctx.finish({ tool: 'picker', kind: 'colour', value: { hex: toHex(rgb).toUpperCase(), rgb, format, text } }, { text });
  };

  const ac = new AbortController();
  const on = { signal: ac.signal };

  window.addEventListener('pointermove', (e) => {
    px = Math.min(stage.width - 1, Math.max(0, Math.floor(e.clientX * stage.sx)));
    py = Math.min(stage.height - 1, Math.max(0, Math.floor(e.clientY * stage.sy)));
    active = true;
    redraw();
  }, on);

  window.addEventListener('click', pick, on);

  window.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'Enter') { e.preventDefault(); pick(); return; }
    else if (e.key === 'Escape') { void ctx.cancel(); return; }
    else return;
    e.preventDefault();
    px = Math.min(stage.width - 1, Math.max(0, px + dx));
    py = Math.min(stage.height - 1, Math.max(0, py + dy));
    active = true;
    redraw();
  }, on);

  hint.set([['Click', 'pick'], ['Arrows', 'move 1 px'], ['Shift', '10 px'], ['Enter', 'pick'], ['Esc', 'cancel']]);
  redraw();

  return () => {
    ac.abort();
    loupe.remove();
  };
};
