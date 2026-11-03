import { el, q, setChecked, setText, setValue } from '../dom';

export interface Row<T> { el: HTMLElement; set(v: T): void }

export const fmt = (v: number): string => String(Number(v.toFixed(3)));
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const keyed = <N extends HTMLElement>(node: N, key: string): N => {
  if (key) node.dataset.pref = key;
  return node;
};

export function grp(label: string, ...content: HTMLElement[]): HTMLElement {
  const g = el('<section class="cv-prefs-group"><h3 class="cv-prefs-label"></h3></section>');
  setText(q(g, '.cv-prefs-label'), label);
  g.append(...content);
  return g;
}

export const note = (text: string): HTMLElement => {
  const n = el('<p class="cv-note"></p>');
  setText(n, text);
  return n;
};

export const cols = (...content: HTMLElement[]): HTMLElement => {
  const c = el('<div class="cv-prefs-cols"></div>');
  c.append(...content);
  return c;
};

export function sliderRow(label: string, min: number, max: number, step: number, onInput: (v: number) => void, key = '', def?: number): Row<number> {
  const root = el(`<div class="cv-field cv-slider"><span></span><div class="cv-slider-ctl"><input type="range" min="${min}" max="${max}" step="${step}"><input class="cv-num" type="number" min="${min}" max="${max}" step="${step}"></div></div>`);
  const lab = q(root, 'span');
  setText(lab, label);
  const range = q<HTMLInputElement>(root, 'input[type="range"]');
  const box = q<HTMLInputElement>(root, 'input.cv-num');
  keyed(range, key);
  range.setAttribute('aria-label', label);
  box.setAttribute('aria-label', `${label} value`);
  const fill = (): void => {
    const span = max - min;
    const pct = `${span > 0 ? clamp(((range.valueAsNumber - min) / span) * 100, 0, 100) : 0}%`;
    if (range.style.getPropertyValue('--pct') !== pct) range.style.setProperty('--pct', pct);
  };
  range.addEventListener('input', () => {
    fill();
    const v = range.valueAsNumber;
    box.value = fmt(v);
    onInput(v);
  });
  box.addEventListener('change', () => {
    const raw = box.valueAsNumber;
    if (!Number.isFinite(raw)) return;
    const v = clamp(Math.round(raw / step) * step, min, max);
    box.value = fmt(v);
    range.value = String(v);
    fill();
    onInput(v);
  });
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); box.blur(); } });
  if (def !== undefined) {
    const reset = (): void => { range.value = String(def); fill(); box.value = fmt(def); onInput(def); };
    lab.addEventListener('dblclick', reset);
    range.addEventListener('dblclick', reset);
    lab.title = 'Double-click to reset';
  }
  let scrub: { x: number; v: number; id: number; on: boolean } | null = null;
  lab.classList.add('cv-scrub');
  lab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    scrub = { x: e.clientX, v: range.valueAsNumber, id: e.pointerId, on: false };
    lab.setPointerCapture(e.pointerId);
  });
  lab.addEventListener('pointermove', (e) => {
    if (!scrub || e.pointerId !== scrub.id) return;
    const dx = e.clientX - scrub.x;
    if (!scrub.on) { if (Math.abs(dx) < 3) return; scrub.on = true; }
    const per = ((max - min) / 250) * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1);
    range.value = String(clamp(Number((Math.round((scrub.v + dx * per) / step) * step).toFixed(6)), min, max));
    range.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const endScrub = (e: PointerEvent): void => {
    if (lab.hasPointerCapture(e.pointerId)) lab.releasePointerCapture(e.pointerId);
    scrub = null;
  };
  lab.addEventListener('pointerup', endScrub);
  lab.addEventListener('pointercancel', endScrub);
  fill();
  return { el: root, set(v) { if (range.valueAsNumber !== v) range.value = String(v); fill(); setValue(box, fmt(v)); } };
}

export function selectRow(label: string, options: ReadonlyArray<readonly [string, string]>, onChange: (v: string) => void, key = ''): Row<string> {
  const root = el(`<label class="cv-field"><span></span><select class="cv-input">${options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`);
  setText(q(root, 'span'), label);
  const sel = keyed(q<HTMLSelectElement>(root, 'select'), key);
  sel.addEventListener('change', () => onChange(sel.value));
  return { el: root, set(v) { if (sel.value !== v) sel.value = v; } };
}

const TOGGLE_TRACK = '<span class="cv-toggle-track"><span class="cv-toggle-knob"></span></span>';

export function toggleRow(label: string, onChange: (v: boolean) => void, key = ''): Row<boolean> {
  const root = el(`<label class="cv-field cv-toggle-row"><span></span><span class="cv-toggle"><input type="checkbox">${TOGGLE_TRACK}</span></label>`);
  setText(q(root, 'span'), label);
  const box = keyed(q<HTMLInputElement>(root, 'input'), key);
  box.setAttribute('role', 'switch');
  box.addEventListener('change', () => onChange(box.checked));
  return { el: root, set(v) { setChecked(box, v); } };
}

export function segmentedRow(label: string, options: ReadonlyArray<readonly [string, string]>, onChange: (v: string) => void, key = ''): Row<string> {
  const root = el(`<div class="cv-field"><span></span><div class="cv-seg" role="radiogroup">${options.map(([v, t]) => `<button class="cv-seg-btn" type="button" role="radio" aria-checked="false" tabindex="-1" data-value="${v}">${t}</button>`).join('')}</div></div>`);
  setText(q(root, 'span'), label);
  const group = keyed(q(root, '.cv-seg'), key);
  group.setAttribute('aria-label', label);
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('.cv-seg-btn'));
  let value = '';
  const paint = (): void => {
    const at = buttons.findIndex((b) => b.dataset.value === value);
    buttons.forEach((b, i) => {
      const on = i === at;
      if (b.getAttribute('aria-checked') !== String(on)) b.setAttribute('aria-checked', String(on));
      b.classList.toggle('is-on', on);
      const tab = on || (at < 0 && i === 0) ? '0' : '-1';
      if (b.getAttribute('tabindex') !== tab) b.setAttribute('tabindex', tab);
    });
  };
  const pick = (v: string): void => { if (v === value) return; value = v; paint(); onChange(v); };
  group.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('.cv-seg-btn') : null;
    if (b?.dataset.value !== undefined) pick(b.dataset.value);
  });
  group.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const at = Math.max(0, buttons.findIndex((b) => b.dataset.value === value));
    const next = buttons[(at + step + buttons.length) % buttons.length];
    pick(next.dataset.value ?? value);
    next.focus();
  });
  return { el: root, set(v) { if (v !== value) { value = v; paint(); } } };
}

export function colorRow(label: string, onChange: (hex: string) => void, key = ''): Row<string> {
  const root = el('<label class="cv-field"><span></span><input class="cv-input cv-color" type="color"></label>');
  setText(q(root, 'span'), label);
  const inp = keyed(q<HTMLInputElement>(root, 'input'), key);
  inp.addEventListener('input', () => onChange(inp.value));
  return { el: root, set(v) { setValue(inp, v); } };
}

export interface ButtonRow { el: HTMLElement; button: HTMLButtonElement }

export function buttonRow(label: string, text: string, onClick: () => void, kind: '' | 'danger' = ''): ButtonRow {
  const root = el(`<div class="cv-field"><span></span><button class="cv-btn${kind ? ` cv-btn-${kind}` : ''}" type="button"></button></div>`);
  setText(q(root, 'span'), label);
  const button = q<HTMLButtonElement>(root, 'button');
  setText(button, text);
  button.addEventListener('click', onClick);
  return { el: root, button };
}

export interface ValueRow { el: HTMLElement; set(text: string): void }

export function valueRow(label: string, wide = false): ValueRow {
  const root = el(`<div class="cv-field cv-valuerow"><span></span>${wide ? '<input class="cv-input" type="text" readonly spellcheck="false">' : '<span class="cv-value"></span>'}</div>`);
  const lab = q(root, 'span');
  setText(lab, label);
  if (wide) {
    const inp = q<HTMLInputElement>(root, 'input');
    inp.setAttribute('aria-label', label);
    return { el: root, set(text) { if (inp.value !== text) inp.value = text; } };
  }
  const val = q(root, '.cv-value');
  return { el: root, set(text) { setText(val, text); } };
}
