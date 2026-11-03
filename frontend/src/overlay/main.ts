import { desk, overlayParams, type DeskResult, type DeskTool } from '../io/desk';
import { delayedIndicator, el, q, setHidden, setText } from '../ui/dom';
import type { BaseCtx, Clip, Disposer, ToolCtx, ToolMount } from './ctx';
import { mountDraw } from './draw';
import { createHint } from './hint';
import { mountPicker } from './picker';
import { mountRuler } from './ruler';
import { Stage } from './stage';
import { mountText } from './text';
import { mountTimer } from './timer';
import { mountZoom } from './zoom';

const params = overlayParams();
const root = q(document, '#ov-root');
document.body.dataset.tool = params.tool;

const MOUNTS: Partial<Record<DeskTool, ToolMount>> = {
  picker: mountPicker,
  ruler: mountRuler,
  text: mountText,
  zoom: mountZoom,
  draw: mountDraw,
};

let stage: Stage | null = null;
let current: Disposer | null = null;
let closing = false;

async function finish(result: DeskResult, clip?: Clip): Promise<void> {
  if (closing) return;
  closing = true;
  if (clip?.text !== undefined) await desk.copyText(clip.text).catch(() => undefined);
  else if (clip?.png && desk.available()) await desk.copyImage(clip.png).catch(() => undefined);
  if (!desk.available()) {
    console.info('[overlay]', JSON.stringify(result));
    closing = false;
    return;
  }
  await desk.emitResult(result).catch(() => undefined);
  await desk.close().catch(() => window.close());
}

const cancel = (): Promise<void> => finish({ tool: params.tool, kind: 'cancel', value: null });

const hint = createHint(root);
const base: BaseCtx = {
  params,
  hint,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  finish,
  cancel,
  switchTo(tool) {
    if (!stage) return;
    const mount = MOUNTS[tool];
    if (!mount) return;
    current?.();
    params.tool = tool;
    document.body.dataset.tool = tool;
    current = mount({ ...base, stage });
  },
};

async function boot(): Promise<void> {
  if (params.tool === 'timer') {
    current = mountTimer(base);
    return;
  }
  const note = el<HTMLElement>('<div class="ov-note" hidden><span class="ov-spin"></span><span class="ov-note-text">Loading the screenshot</span></div>');
  root.append(note);
  const hide = delayedIndicator(() => setHidden(note, false), () => setHidden(note, true));
  const s = new Stage(params.scale);
  try {
    await s.load(params.shot);
  } catch (e) {
    hide();
    const sentence = e instanceof Error ? e.message : String(e);
    setText(q(note, '.ov-note-text'), sentence);
    note.classList.add('is-error');
    setHidden(note, false);
    await finish({ tool: params.tool, kind: 'error', value: sentence });
    return;
  }
  hide();
  stage = s;
  root.prepend(s.root);
  const mount = MOUNTS[params.tool];
  if (mount) current = mount({ ...base, stage: s } as ToolCtx);
}

void boot();
