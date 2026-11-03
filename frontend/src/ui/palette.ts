import { el, escapeHtml, patchList, q, setClass, setText } from './dom';
import type { Command, Commands } from './commands';

export class Palette {
  readonly root = el<HTMLElement>(`<div class="cv-scrim ft-palette-scrim" hidden>
      <div class="cv-search-pop ft-palette" role="dialog" aria-label="Commands">
        <input class="cv-search-input" type="text" spellcheck="false" autocomplete="off" placeholder="Type a command" aria-label="Command">
        <div class="cv-search-results" role="listbox"></div>
      </div></div>`);
  private readonly input = q<HTMLInputElement>(this.root, 'input');
  private readonly list = q(this.root, '.cv-search-results');
  private shown: Command[] = [];
  private at = 0;
  private lastFocus: Element | null = null;

  constructor(private readonly commands: Commands) {
    this.input.addEventListener('input', () => { this.at = 0; this.render(); });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.pick(this.at); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
    });
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
    this.list.addEventListener('click', (e) => {
      const n = e.target instanceof Element ? e.target.closest<HTMLElement>('.cv-search-item') : null;
      if (n) this.pick(this.shown.findIndex((c) => c.id === n.dataset.key));
    });
  }

  get isOpen(): boolean { return !this.root.hidden; }

  open(): void {
    this.lastFocus = document.activeElement;
    this.input.value = '';
    this.at = 0;
    this.render();
    this.root.hidden = false;
    this.input.focus();
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    if (this.lastFocus instanceof HTMLElement) this.lastFocus.focus({ preventScroll: true });
  }

  private render(): void {
    const f = this.input.value.trim().toLowerCase();
    this.shown = this.commands.all().filter((c) => c.id !== 'palette' && this.commands.enabled(c) && (!f || `${c.label} ${c.group} ${c.description}`.toLowerCase().includes(f))).slice(0, 12);
    const update = (n: HTMLElement, c: Command): void => { setText(q(n, '.ft-pal-label'), c.label); setText(q(n, '.cv-search-keys'), this.commands.keyLabel(c)); };
    patchList(this.list, this.shown, {
      key: (c) => c.id,
      create: (c) => { const n = el<HTMLElement>(`<button class="cv-search-item" type="button" role="option" title="${escapeHtml(c.description)}"><span class="ft-pal-label"></span><span class="cv-search-keys"></span></button>`); update(n, c); return n; },
      update,
    });
    this.move(0);
  }

  private move(d: number): void {
    if (!this.shown.length) return;
    this.at = (this.at + d + this.shown.length) % this.shown.length;
    Array.from(this.list.children).forEach((n, i) => setClass(n, 'is-picked', i === this.at));
  }

  private pick(i: number): void {
    const c = this.shown[i];
    if (!c) return;
    this.close();
    this.commands.run(c.id);
  }
}
