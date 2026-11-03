import type { ActionParam } from '../../io/api';
import { el, escapeHtml } from '../dom';

export function fieldFor(p: ActionParam, value: unknown): HTMLElement {
  const v = value ?? p.default;
  const label = `<span class="ft-row-label">${escapeHtml(p.label)}</span>`;
  const attrs = `data-key="${escapeHtml(p.key)}" data-type="${p.type}"`;
  switch (p.type) {
    case 'bool':
      return el(`<label class="ft-row ft-field">${label}<input type="checkbox" class="ft-check" ${attrs} ${v ? 'checked' : ''}></label>`);
    case 'choice':
      return el(`<label class="ft-row ft-field">${label}<select class="cv-hf-sort" ${attrs}>${(p.options ?? []).map(([o, t]) => `<option value="${escapeHtml(o)}" ${String(v) === o ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>`);
    case 'color':
      return el(`<label class="ft-row ft-field">${label}<input type="color" class="ft-accent" ${attrs} value="${escapeHtml(String(v || '#000000'))}"></label>`);
    case 'text':
    case 'path':
      return el(`<label class="ft-row ft-field">${label}<input type="text" class="ft-input ft-input-wide" spellcheck="false" ${attrs} value="${escapeHtml(String(v ?? ''))}" ${p.type === 'path' ? 'placeholder="Full path"' : ''}></label>`);
    default: {
      const min = p.min ?? '', max = p.max ?? '', step = p.step ?? (p.type === 'int' ? 1 : 0.01);
      return el(`<label class="ft-row ft-field">${label}<input type="number" class="ft-input" ${attrs} min="${min}" max="${max}" step="${step}" value="${escapeHtml(String(v ?? 0))}"></label>`);
    }
  }
}

export function readFields(root: HTMLElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const n of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-key]')) {
    const key = n.dataset.key!;
    const type = n.dataset.type;
    if (n instanceof HTMLInputElement && n.type === 'checkbox') out[key] = n.checked;
    else if (type === 'int') out[key] = Math.round(Number(n.value));
    else if (type === 'float') out[key] = Number(n.value);
    else out[key] = n.value;
  }
  return out;
}
