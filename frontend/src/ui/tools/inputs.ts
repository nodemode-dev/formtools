import { el, escapeHtml, patchList, q, setHidden, setText } from '../dom';
import { icon } from '../icons';

const base = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;

export class InputList {
  readonly root = el<HTMLElement>(`<section class="ft-panel ft-inputs">
      <header class="ft-panel-head"><span class="ft-panel-title">Files</span><span class="ft-panel-count"></span>
        <button class="cv-tt-btn" type="button" data-in="clear" title="Clear the list" aria-label="Clear the list">${icon('close', 14)}</button></header>
      <div class="ft-inputs-add">
        <input type="text" class="ft-input ft-input-wide ft-inputs-path" spellcheck="false" placeholder="Add a file or folder path and press Enter" aria-label="Add a path">
        <button class="ft-btn" type="button" data-in="selection">Use the browser's selection</button>
      </div>
      <label class="ft-row ft-inputs-rec"><span class="ft-row-label">Include sub-folders</span><input type="checkbox" class="ft-check ft-inputs-recursive"></label>
      <div class="ft-inputs-list" role="list"></div>
      <p class="ft-note ft-inputs-empty">Select files or a folder in the browser, then open this tool, or add a path above.</p>
    </section>`);
  private paths: string[] = [];
  private readonly list = q(this.root, '.ft-inputs-list');
  private readonly listeners = new Set<() => void>();

  constructor(private readonly fromSelection: () => string[], showRecursive = true) {
    setHidden(q(this.root, '.ft-inputs-rec'), !showRecursive);
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const act = t?.closest<HTMLElement>('[data-in]')?.dataset.in;
      if (act === 'clear') this.set([]);
      else if (act === 'selection') this.set(this.fromSelection());
      const rm = t?.closest<HTMLElement>('[data-remove]')?.dataset.remove;
      if (rm) this.set(this.paths.filter((p) => p !== rm));
    });
    const input = q<HTMLInputElement>(this.root, '.ft-inputs-path');
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = input.value.trim();
      if (v && !this.paths.includes(v)) this.set([...this.paths, v]);
      input.value = '';
    });
    q(this.root, '.ft-inputs-recursive').addEventListener('change', () => this.emit());
    this.render();
  }

  get recursive(): boolean { return q<HTMLInputElement>(this.root, '.ft-inputs-recursive').checked; }

  get value(): string[] { return [...this.paths]; }

  onChange(fn: () => void): void { this.listeners.add(fn); }

  private emit(): void { for (const l of this.listeners) l(); }

  set(paths: string[]): void {
    this.paths = [...new Set(paths)];
    this.render();
    this.emit();
  }

  private render(): void {
    setText(q(this.root, '.ft-panel-count'), this.paths.length ? `${this.paths.length}` : '');
    setHidden(q(this.root, '.ft-inputs-empty'), this.paths.length > 0);
    const shown = this.paths.slice(0, 500);
    const update = (n: HTMLElement, p: string): void => { setText(q(n, '.ft-inputs-name'), base(p)); n.title = p; };
    patchList(this.list, shown, {
      key: (p) => p,
      create: (p) => { const n = el<HTMLElement>(`<div class="ft-inputs-item" role="listitem"><span class="ft-inputs-name"></span><button class="ft-icon-x" type="button" data-remove="${escapeHtml(p)}" aria-label="Remove">${icon('close', 12)}</button></div>`); update(n, p); return n; },
      update,
    });
  }
}
