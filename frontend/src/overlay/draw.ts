import { icon } from '../ui/icons';
import { el, q, setClass, setStyleVar, setText } from '../ui/dom';
import type { ToolMount } from './ctx';
import { frameLoop, place } from './stage';

type Kind = 'pen' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'ellipse';
type Pt = [number, number];

interface Mark {
  kind: Kind | 'text';
  color: string;
  width: number;
  pts: Pt[];
  text: string;
  size: number;
}

const TOOLS: Array<[Kind, string, string]> = [
  ['pen', 'tPencil', 'Pen'],
  ['highlighter', 'tBrush', 'Highlighter'],
  ['line', 'tLine', 'Line'],
  ['arrow', 'tArrow', 'Arrow'],
  ['rect', 'tRect', 'Rectangle'],
  ['ellipse', 'tEllipseShape', 'Ellipse'],
];

const COLORS: Record<string, string> = {
  r: '#ff2d2d',
  g: '#22d35a',
  b: '#2f7bff',
  y: '#ffd60a',
  o: '#ff9500',
  p: '#ff4fd8',
  '0': '#000000',
  '9': '#ffffff',
};

const HIGHLIGHT = 4;
const FONT = '600 {s}px Inter, system-ui, sans-serif';

function paint(g: CanvasRenderingContext2D, m: Mark): void {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = m.color;
  g.fillStyle = m.color;
  g.lineWidth = m.width;
  const a = m.pts[0];
  const b = m.pts[m.pts.length - 1];
  if (m.kind === 'text') {
    g.font = FONT.replace('{s}', String(m.size));
    g.textBaseline = 'top';
    m.text.split('\n').forEach((line, i) => g.fillText(line, a[0], a[1] + i * m.size * 1.25));
  } else if (m.kind === 'pen' || m.kind === 'highlighter') {
    if (m.kind === 'highlighter') {
      g.globalAlpha = 0.35;
      g.lineCap = 'square';
    }
    if (m.pts.length === 1) {
      g.beginPath();
      g.arc(a[0], a[1], m.width / 2, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(a[0], a[1]);
      for (let i = 1; i < m.pts.length - 1; i++) {
        const p = m.pts[i], n = m.pts[i + 1];
        g.quadraticCurveTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2);
      }
      g.lineTo(b[0], b[1]);
      g.stroke();
    }
  } else if (m.kind === 'line' || m.kind === 'arrow') {
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
    if (m.kind === 'arrow' && (a[0] !== b[0] || a[1] !== b[1])) {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const len = Math.max(m.width * 4, 14);
      g.beginPath();
      g.moveTo(b[0], b[1]);
      g.lineTo(b[0] - len * Math.cos(ang - 0.45), b[1] - len * Math.sin(ang - 0.45));
      g.lineTo(b[0] - len * Math.cos(ang + 0.45), b[1] - len * Math.sin(ang + 0.45));
      g.closePath();
      g.fill();
    }
  } else if (m.kind === 'rect') {
    g.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  } else {
    g.beginPath();
    g.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

export const mountDraw: ToolMount = (ctx) => {
  const { stage, hint } = ctx;
  let kind: Kind = 'pen';
  let textMode = false;
  let colorKey = 'r';
  let width = 4;
  let marks: Mark[] = [];
  let live: Mark | null = null;
  let board: 'none' | 'white' | 'black' = 'none';
  let tabHeld = false;
  let typing: { x: number; y: number; size: number } | null = null;
  let pointer = { x: -100, y: -100 };
  let dirty = true;

  const ink = stage.addLayer('ov-ink');
  const ig = ink.getContext('2d');
  const committed = document.createElement('canvas');
  committed.width = stage.width;
  committed.height = stage.height;
  const cg = committed.getContext('2d');

  const chip = el<HTMLElement>(`<div class="ov-chip ov-drawchip"><i class="ov-dot"></i>${TOOLS.map(([k, ic, label]) => `<span class="ov-tool" data-kind="${k}" title="${label}">${icon(ic, 14)}</span>`).join('')}<span class="ov-tool" data-kind="text" title="Text">${icon('tType', 14)}</span><span class="ov-width"></span></div>`);
  const widthLabel = q(chip, '.ov-width');
  const toolSpans = Array.from(chip.querySelectorAll<HTMLElement>('.ov-tool'));
  const ring = el<HTMLElement>('<div class="ov-ring"></div>');
  const field = el<HTMLTextAreaElement>('<textarea class="ov-textin" rows="1" spellcheck="false" hidden></textarea>');
  stage.root.append(chip, ring, field);

  const color = (): string => COLORS[colorKey];
  const strokeWidth = (k: Kind | 'text'): number => (k === 'highlighter' ? width * HIGHLIGHT : width) * stage.sx;
  const textSize = (): number => (12 + width * 3) * stage.sx;

  const redraw = frameLoop(() => {
    if (ig && dirty) {
      dirty = false;
      ig.clearRect(0, 0, ink.width, ink.height);
      ig.drawImage(committed, 0, 0);
      if (live) paint(ig, live);
    }
    const active = textMode ? 'text' : kind;
    toolSpans.forEach((s) => setClass(s, 'is-on', s.dataset.kind === active));
    setStyleVar(chip, '--ink', color());
    setText(widthLabel, `${width}`);
    const d = Math.max(6, (kind === 'highlighter' ? width * HIGHLIGHT : width) * stage.view.z);
    setStyleVar(ring, '--ring', `${d}px`);
    setStyleVar(ring, '--ink', color());
    setClass(ring, 'is-off', textMode);
    place(ring, pointer.x - d / 2, pointer.y - d / 2);
    setClass(stage.world, 'is-white', board === 'white');
    setClass(stage.world, 'is-black', board === 'black');
  });

  const rebuild = (): void => {
    dirty = true;
    if (!cg) return;
    cg.clearRect(0, 0, committed.width, committed.height);
    marks.forEach((m) => paint(cg, m));
  };

  const commit = (m: Mark): void => {
    marks.push(m);
    dirty = true;
    if (cg) paint(cg, m);
  };

  const endText = (save: boolean): void => {
    if (!typing) return;
    const t = typing;
    typing = null;
    const text = field.value.replace(/\s+$/, '');
    field.hidden = true;
    field.value = '';
    if (save && text) commit({ kind: 'text', color: color(), width: 0, pts: [[t.x, t.y]], text, size: t.size });
    redraw();
  };

  const startText = (e: PointerEvent): void => {
    endText(true);
    const p = stage.toPhys(e.clientX, e.clientY);
    const css = textSize() / stage.sx;
    typing = { x: p.x, y: p.y, size: textSize() };
    field.hidden = false;
    field.value = '';
    field.style.fontSize = `${css * stage.view.z}px`;
    field.style.color = color();
    field.style.width = '8ch';
    field.style.height = `${css * stage.view.z * 1.25}px`;
    place(field, e.clientX, e.clientY);
    window.setTimeout(() => field.focus(), 0);
  };

  const effectiveKind = (e: PointerEvent | KeyboardEvent): Kind => {
    if (e.ctrlKey && e.shiftKey) return 'arrow';
    if (e.shiftKey) return 'line';
    if (e.ctrlKey || e.metaKey) return 'rect';
    if (tabHeld) return 'ellipse';
    return kind;
  };

  const ac = new AbortController();
  const on = { signal: ac.signal };

  field.addEventListener('input', () => {
    const lines = field.value.split('\n');
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
    field.style.width = `${Math.max(8, ...lines.map((l) => l.length + 1))}ch`;
  }, on);
  field.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); endText(false); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); endText(true); }
  }, on);
  field.addEventListener('blur', () => endText(true), on);
  field.addEventListener('pointerdown', (e) => e.stopPropagation(), on);

  stage.root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    pointer = { x: e.clientX, y: e.clientY };
    if (textMode) { e.preventDefault(); startText(e); return; }
    const k = effectiveKind(e);
    const p = stage.toPhys(e.clientX, e.clientY);
    live = { kind: k, color: color(), width: strokeWidth(k), pts: [[p.x, p.y]], text: '', size: 0 };
    stage.root.setPointerCapture(e.pointerId);
    dirty = true;
    redraw();
  }, on);

  stage.root.addEventListener('pointermove', (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    if (live) {
      dirty = true;
      const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const src = list.length ? list : [e];
      if (live.kind === 'pen' || live.kind === 'highlighter') {
        for (const ev of src) {
          const p = stage.toPhys(ev.clientX, ev.clientY);
          live.pts.push([p.x, p.y]);
        }
      } else {
        const p = stage.toPhys(e.clientX, e.clientY);
        live.pts = [live.pts[0], [p.x, p.y]];
        live.kind = effectiveKind(e);
        live.width = strokeWidth(live.kind);
      }
    }
    redraw();
  }, on);

  const release = (): void => {
    if (!live) return;
    const m = live;
    live = null;
    commit(m);
    redraw();
  };
  stage.root.addEventListener('pointerup', release, on);
  stage.root.addEventListener('pointercancel', release, on);

  window.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    width = Math.min(40, Math.max(1, width + (e.deltaY < 0 ? 1 : -1)));
    redraw();
  }, { signal: ac.signal, passive: false });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') tabHeld = false;
  }, on);

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.key === 'Tab') { e.preventDefault(); tabHeld = true; return; }
    if (e.key === 'Escape') { void ctx.cancel(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      marks.pop();
      rebuild();
      redraw();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'c') {
      e.preventDefault();
      void stage.png(committed, board === 'white' ? '#ffffff' : board === 'black' ? '#000000' : undefined).then((png) => ctx.finish({ tool: 'draw', kind: 'image', value: { width: stage.width, height: stage.height, bytes: png.length } }, { png }));
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k in COLORS) { colorKey = k; redraw(); return; }
    if (k >= '1' && k <= '6') { kind = TOOLS[Number(k) - 1][0]; textMode = false; redraw(); return; }
    if (k === 't') { textMode = !textMode; redraw(); return; }
    if (k === 'e') { marks = []; rebuild(); redraw(); return; }
    if (k === 'w') { board = board === 'white' ? 'none' : 'white'; redraw(); return; }
    if (k === 'k') { board = board === 'black' ? 'none' : 'black'; redraw(); return; }
    if (e.key === '[' || e.key === ']') {
      width = Math.min(40, Math.max(1, width + (e.key === ']' ? 1 : -1)));
      redraw();
    }
  }, on);

  void document.fonts.load(FONT.replace('{s}', '16'));
  hint.set([
    ['1-6', 'pen, marker, line, arrow, box, ellipse'],
    ['R G B Y O P', 'colour'],
    ['0 9', 'black, white'],
    ['T', 'text'],
    ['Shift Ctrl Tab', 'line, box, ellipse'],
    ['W K', 'boards'],
    ['Ctrl+Z', 'undo'],
    ['E', 'clear'],
    ['Ctrl+C', 'copy'],
    ['Esc', 'close'],
  ]);
  redraw();

  return () => {
    ac.abort();
    endText(false);
    ink.remove();
    chip.remove();
    ring.remove();
    field.remove();
  };
};
