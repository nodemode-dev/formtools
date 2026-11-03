import { el, q, setText } from '../ui/dom';
import type { ToolMount } from './ctx';
import { frameLoop } from './stage';

const MIN = 1.25;
const MAX = 8;
const STEP = 1.25;

const clamp = (v: number): number => Math.min(MAX, Math.max(MIN, v));

export const mountZoom: ToolMount = (ctx) => {
  const { stage, params, hint, reduced } = ctx;
  const asked = Number(params.options.zoom);
  let target = clamp(Number.isFinite(asked) && asked > 0 ? asked : 2);
  let cur = reduced ? target : 1;
  let mx = innerWidth / 2;
  let my = innerHeight / 2;

  const chip = el<HTMLElement>('<div class="ov-chip ov-zoomchip"><span class="ov-zoomval"></span></div>');
  const value = q(chip, '.ov-zoomval');
  stage.root.append(chip);

  const redraw = frameLoop(() => {
    const diff = target - cur;
    if (Math.abs(diff) < 0.003) cur = target;
    else cur += diff * 0.25;
    stage.setView(cur, -mx * (cur - 1), -my * (cur - 1));
    setText(value, `${+target.toFixed(2)}x`);
    if (cur !== target) redraw();
  });

  const zoomBy = (factor: number): void => {
    target = clamp(target * factor);
    redraw();
  };

  const ac = new AbortController();
  const on = { signal: ac.signal };

  window.addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    redraw();
  }, on);

  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : 1;
    zoomBy(Math.exp(-e.deltaY * unit * 0.0015));
  }, { signal: ac.signal, passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { void ctx.cancel(); return; }
    if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp') { e.preventDefault(); zoomBy(STEP); return; }
    if (e.key === '-' || e.key === '_' || e.key === 'ArrowDown') { e.preventDefault(); zoomBy(1 / STEP); return; }
    if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) ctx.switchTo('draw');
  }, on);

  hint.set([['Wheel', 'zoom'], ['+ -', 'zoom'], ['Move', 'pan'], ['D', 'draw'], ['Esc', 'close']]);
  redraw();

  return () => {
    ac.abort();
    cur = target;
    stage.setView(cur, -mx * (cur - 1), -my * (cur - 1));
    chip.remove();
  };
};
