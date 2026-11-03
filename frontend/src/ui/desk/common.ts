import { desk, type DeskCaps, type DeskResult, type DeskTool } from '../../io/desk';
import { el, q, setClass, setDisabled, setHidden, setText } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import './icons';

export interface DeskDeps { status: (text: string) => void; back?: () => void }

export type SectionId = 'picker' | 'ruler' | 'text' | 'zoom' | 'timer' | 'awake' | 'topmost' | 'hosts' | 'env';

export abstract class DeskSection {
  readonly root: HTMLElement;
  protected readonly msg: HTMLElement;
  protected readonly body: HTMLElement;
  supported = false;

  constructor(readonly id: SectionId, title: string, ic: string, readonly offline: string, bodyHtml: string, protected readonly deps: DeskDeps) {
    this.root = el<HTMLElement>(`<div class="ft-desk-view" data-desk="${id}" hidden>
        <section class="ft-panel ft-desk-panel">
          <header class="ft-panel-head">${icon(ic, 16)}<span class="ft-panel-title">${title}</span></header>
          <p class="ft-note ft-desk-msg"></p>
          <div class="ft-desk-body" hidden>${bodyHtml}</div>
        </section>
      </div>`);
    this.msg = q(this.root, '.ft-desk-msg');
    this.body = q(this.root, '.ft-desk-body');
  }

  setSupport(ok: boolean, reason: string): void {
    this.supported = ok;
    setHidden(this.body, !ok);
    setHidden(this.msg, ok);
    setText(this.msg, ok ? '' : reason);
    if (ok) this.ready();
  }

  protected ready(): void { return; }

  describe(_caps: DeskCaps): void { return; }

  shown(): void { return; }

  run(_tool?: DeskTool): void { return; }

  result(_r: DeskResult): void { return; }
}

export async function copyText(text: string, deps: DeskDeps, what = 'Copied'): Promise<void> {
  try {
    await desk.copyText(text);
    deps.status(`${what}.`);
    toast(`${what}.`);
  } catch (e) { toast(e instanceof Error ? e.message : 'The clipboard did not take it.', 'error'); }
}

export async function startTool(tool: DeskTool, options: Record<string, unknown>, deps: DeskDeps): Promise<void> {
  try {
    await desk.start(tool, options);
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    deps.status(text);
    toast(text, 'error');
  }
}

export function armButton(btn: HTMLButtonElement, needs: () => boolean, ask: () => string, action: () => void): () => void {
  let armed = 0;
  const label = q(btn, '.ft-u-btn-label');
  const original = label.textContent ?? '';
  const disarm = (): void => {
    if (armed) { window.clearTimeout(armed); armed = 0; }
    setText(label, original);
    setClass(btn, 'is-danger', false);
  };
  btn.addEventListener('click', () => {
    if (!needs()) { disarm(); action(); return; }
    if (armed) { disarm(); action(); return; }
    setText(label, ask());
    setClass(btn, 'is-danger', true);
    armed = window.setTimeout(disarm, 4000);
  });
  btn.addEventListener('blur', disarm);
  return disarm;
}

export function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.text === 'string') return v.text;
    if (typeof v.w === 'number' && typeof v.h === 'number') return `${v.w} x ${v.h}`;
    if (typeof v.width === 'number' && typeof v.height === 'number') return `${v.width} x ${v.height}`;
    if (typeof v.length === 'number') return String(v.length);
  }
  return '';
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function lockBusy(buttons: HTMLButtonElement[], busy: boolean): void {
  for (const b of buttons) setDisabled(b, busy);
}

export const btn = (action: string, ic: string, label: string, primary = false): string =>
  `<button class="ft-btn${primary ? ' is-primary' : ''}" type="button" data-act="${action}">${icon(ic, 14)} <span class="ft-u-btn-label">${label}</span></button>`;
