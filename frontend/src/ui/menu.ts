import { el, q, setClass, setDisabled, setText } from './dom';
import type { Commands } from './commands';

export type MenuItem = string | '-';
export interface MenuDef { label: string; items: MenuItem[] }

interface Row { id: string; node: HTMLButtonElement }

class Popup {
  readonly panel = el<HTMLDivElement>('<div class="cv-menu" role="menu" hidden></div>');
  private rows: Row[] = [];

  constructor(private readonly commands: Commands, items: MenuItem[], private readonly done: () => void) {
    for (const item of items) {
      if (item === '-') { this.panel.appendChild(el('<div class="cv-menu-sep"></div>')); continue; }
      const cmd = commands.get(item);
      if (!cmd) continue;
      const node = el<HTMLButtonElement>('<button class="cv-menu-item" role="menuitem" type="button"><span class="cv-menu-check"></span><span class="cv-menu-label"></span><span class="cv-menu-keys"></span></button>');
      setText(q(node, '.cv-menu-label'), cmd.label);
      setText(q(node, '.cv-menu-keys'), commands.keyLabel(cmd));
      node.addEventListener('click', () => { this.done(); commands.run(item); });
      this.rows.push({ id: item, node });
      this.panel.appendChild(node);
    }
  }

  sync(): void {
    for (const r of this.rows) {
      const cmd = this.commands.get(r.id);
      if (!cmd) continue;
      setDisabled(r.node, !this.commands.enabled(cmd));
      setClass(r.node, 'is-checked', !!cmd.checked?.());
    }
  }

  items(): HTMLButtonElement[] { return this.rows.map((r) => r.node).filter((n) => !n.disabled); }
}

export class MenuBar {
  readonly root = el<HTMLDivElement>('<nav class="cv-menubar" role="menubar" aria-label="Menu"></nav>');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly popups: Popup[] = [];
  private open = -1;

  constructor(commands: Commands, defs: MenuDef[], overlay: HTMLElement) {
    defs.forEach((def, i) => {
      const btn = el<HTMLButtonElement>('<button class="cv-menu-btn" type="button" role="menuitem" aria-haspopup="menu"></button>');
      setText(btn, def.label);
      const pop = new Popup(commands, def.items, () => this.close());
      overlay.appendChild(pop.panel);
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.open === i) this.close(); else this.show(i); });
      btn.addEventListener('pointerenter', () => { if (this.open >= 0 && this.open !== i) this.show(i); });
      this.buttons.push(btn);
      this.popups.push(pop);
      this.root.appendChild(btn);
    });
    document.addEventListener('pointerdown', (e) => {
      if (this.open < 0) return;
      const t = e.target as Node;
      if (this.root.contains(t) || this.popups[this.open].panel.contains(t)) return;
      this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (this.open < 0) return;
      const items = this.popups[this.open].items();
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(at + 1) % items.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.show((this.open + 1) % this.buttons.length); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.show((this.open - 1 + this.buttons.length) % this.buttons.length); }
    }, true);
    window.addEventListener('blur', () => this.close());
  }

  get isOpen(): boolean { return this.open >= 0; }

  private show(i: number): void {
    if (this.open >= 0) { this.popups[this.open].panel.hidden = true; setClass(this.buttons[this.open], 'is-open', false); }
    const pop = this.popups[i], btn = this.buttons[i];
    pop.sync();
    const r = btn.getBoundingClientRect();
    pop.panel.style.left = `${Math.round(r.left)}px`;
    pop.panel.style.top = `${Math.round(r.bottom + 4)}px`;
    pop.panel.hidden = false;
    setClass(btn, 'is-open', true);
    this.open = i;
  }

  close(): void {
    if (this.open < 0) return;
    this.popups[this.open].panel.hidden = true;
    setClass(this.buttons[this.open], 'is-open', false);
    this.open = -1;
  }
}
