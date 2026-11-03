import { el, patchList, q, setHidden, setText } from '../dom';
import { icon } from '../icons';
import { clock, copyText, type DeskDeps } from './common';
import { loadList, saveList } from './store';

interface Entry { id: string; text: string; at: number }

const isEntry = (v: unknown): v is Entry => {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.text === 'string' && typeof e.at === 'number';
};

export class HistoryList {
  readonly root = el<HTMLElement>(`<div class="ft-desk-history">
      <p class="ft-note ft-desk-empty"></p>
      <div class="ft-desk-list" role="list"></div>
    </div>`);
  private entries: Entry[];
  private serial = 0;

  constructor(private readonly key: string, private readonly max: number, empty: string, private readonly deps: DeskDeps, private readonly changed: () => void) {
    this.entries = loadList(key, isEntry);
    setText(q(this.root, '.ft-desk-empty'), empty);
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const id = t?.closest<HTMLElement>('[data-entry]')?.dataset.entry;
      const act = t?.closest<HTMLElement>('[data-hist]')?.dataset.hist;
      const hit = this.entries.find((x) => x.id === id);
      if (!hit) return;
      if (act === 'copy') void copyText(hit.text, this.deps, 'Copied');
      else if (act === 'remove') { this.entries = this.entries.filter((x) => x.id !== hit.id); this.save(); }
    });
    this.paint();
  }

  get size(): number { return this.entries.length; }

  add(text: string): void {
    const at = Date.now();
    this.serial += 1;
    this.entries = [{ id: `${at}-${this.serial}`, text, at }, ...this.entries].slice(0, this.max);
    this.save();
  }

  clear(): void {
    this.entries = [];
    this.save();
  }

  private save(): void {
    saveList(this.key, this.entries);
    this.paint();
    this.changed();
  }

  private paint(): void {
    setHidden(q(this.root, '.ft-desk-empty'), this.entries.length > 0);
    patchList(q(this.root, '.ft-desk-list'), this.entries, {
      key: (x) => x.id,
      create: (x) => {
        const n = el<HTMLElement>(`<div class="ft-desk-item" role="listitem" data-entry="${x.id}">
            <span class="ft-desk-item-text"></span>
            <span class="ft-desk-item-time"></span>
            <button class="ft-icon-x" type="button" data-hist="copy" title="Copy" aria-label="Copy">${icon('ftCopy', 14)}</button>
            <button class="ft-icon-x" type="button" data-hist="remove" title="Remove from the list" aria-label="Remove from the list">${icon('close', 12)}</button>
          </div>`);
        setText(q(n, '.ft-desk-item-text'), x.text);
        setText(q(n, '.ft-desk-item-time'), clock(x.at));
        return n;
      },
      update: () => undefined,
    });
  }
}
