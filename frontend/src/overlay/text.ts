import { desk } from '../io/desk';
import { delayedIndicator, el, q, setHidden, setStyleVar, setText } from '../ui/dom';
import type { ToolMount } from './ctx';
import { frameLoop } from './stage';

const MIN = 4;

export const mountText: ToolMount = (ctx) => {
  const { stage, params, hint } = ctx;
  const lang = typeof params.options.lang === 'string' && params.options.lang ? params.options.lang : null;

  const sel = el<HTMLElement>('<div class="ov-sel" hidden><span class="ov-sel-size"></span></div>');
  const size = q(sel, '.ov-sel-size');
  const busy = el<HTMLElement>('<div class="ov-busy" hidden><span class="ov-spin"></span><span>Reading the text</span></div>');
  stage.root.append(sel, busy);

  let start: { x: number; y: number } | null = null;
  let end = { x: 0, y: 0 };
  let working = false;

  const rect = (): { x: number; y: number; w: number; h: number } => {
    const a = start ?? end;
    const x0 = Math.min(a.x, end.x), y0 = Math.min(a.y, end.y);
    const x1 = Math.max(a.x, end.x), y1 = Math.max(a.y, end.y);
    return { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1) - Math.floor(x0), h: Math.ceil(y1) - Math.floor(y0) };
  };

  const redraw = frameLoop(() => {
    if (!start) { setHidden(sel, true); return; }
    const r = rect();
    setHidden(sel, false);
    setStyleVar(sel, '--x', `${r.x / stage.sx}px`);
    setStyleVar(sel, '--y', `${r.y / stage.sy}px`);
    setStyleVar(sel, '--w', `${r.w / stage.sx}px`);
    setStyleVar(sel, '--h', `${r.h / stage.sy}px`);
    setText(size, `${r.w} x ${r.h}`);
  });

  const recognise = async (r: { x: number; y: number; w: number; h: number }): Promise<void> => {
    working = true;
    const hide = delayedIndicator(() => setHidden(busy, false), () => setHidden(busy, true));
    try {
      const out = await desk.ocr(params.shot, r, lang);
      hide();
      const text = out.text.trim();
      if (!text) {
        working = false;
        start = null;
        redraw();
        hint.say('No text found there. Drag another region.');
        return;
      }
      await ctx.finish({ tool: 'text', kind: 'text', value: { text, engine: out.engine, rect: r } }, { text });
    } catch (e) {
      hide();
      const sentence = e instanceof Error ? e.message : String(e);
      await ctx.finish({ tool: 'text', kind: 'error', value: sentence });
    }
  };

  const point = (e: PointerEvent): { x: number; y: number } => ({
    x: Math.min(stage.width, Math.max(0, e.clientX * stage.sx)),
    y: Math.min(stage.height, Math.max(0, e.clientY * stage.sy)),
  });

  const ac = new AbortController();
  const on = { signal: ac.signal };

  stage.root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || working) return;
    start = point(e);
    end = start;
    stage.root.setPointerCapture(e.pointerId);
    redraw();
  }, on);

  stage.root.addEventListener('pointermove', (e) => {
    if (!start || working) return;
    end = point(e);
    redraw();
  }, on);

  stage.root.addEventListener('pointerup', (e) => {
    if (!start || working) return;
    end = point(e);
    const r = rect();
    if (r.w < MIN || r.h < MIN) {
      start = null;
      redraw();
      return;
    }
    redraw();
    void recognise(r);
  }, on);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') void ctx.cancel();
  }, on);

  hint.set([['Drag', 'select the text'], ['Esc', 'cancel']]);

  return () => {
    ac.abort();
    sel.remove();
    busy.remove();
  };
};
