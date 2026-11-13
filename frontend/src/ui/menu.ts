import { el, q, setClass, setDisabled, setText } from './dom';
import { icon } from './icons';
import type { Commands } from './commands';

export type MenuItem = string | '-' | SubMenu;
export interface SubMenu { label: string; items: MenuItem[] }
export interface MenuDef { label: string; items: MenuItem[] }

interface Row { id: string; node: HTMLButtonElement }

class Popup {
  readonly panel = el<HTMLDivElement>('<div class="cv-menu" role="menu" hidden></div>');
  private rows: Row[] = [];
  private subs: Array<{ node: HTMLButtonElement; pop: Popup }> = [];
  private openSub: { node: HTMLButtonElement; pop: Popup } | null = null;

  constructor(private readonly commands: Commands, items: MenuItem[], private readonly done: () => void, overlay?: HTMLElement) {
    for (const item of items) {
      if (item === '-') { this.panel.appendChild(el('<div class="cv-menu-sep"></div>')); continue; }
      if (typeof item === 'object') {
        const node = el<HTMLButtonElement>(`<button class="cv-menu-item cv-menu-sub" role="menuitem" aria-haspopup="menu" aria-expanded="false" type="button"><span class="cv-menu-check"></span><span class="cv-menu-label"></span><span class="cv-menu-keys">${icon('chevronRight', 12)}</span></button>`);
        setText(q(node, '.cv-menu-label'), item.label);
        const sub = { node, pop: new Popup(commands, item.items, done, overlay) };
        overlay?.appendChild(sub.pop.panel);
        node.addEventListener('pointerenter', () => this.showSub(sub, false));
        node.addEventListener('click', (e) => this.showSub(sub, e.detail === 0));
        this.subs.push(sub);
        this.panel.appendChild(node);
        continue;
      }
      const cmd = commands.get(item);
      if (!cmd) continue;
      const node = el<HTMLButtonElement>('<button class="cv-menu-item" role="menuitem" type="button"><span class="cv-menu-check"></span><span class="cv-menu-label"></span><span class="cv-menu-keys"></span></button>');
      setText(q(node, '.cv-menu-label'), cmd.label);
      setText(q(node, '.cv-menu-keys'), commands.keyLabel(cmd));
      node.addEventListener('pointerenter', () => this.closeSub());
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

  items(): HTMLButtonElement[] {
    if (this.openSub && this.openSub.pop.panel.contains(document.activeElement)) return this.openSub.pop.items();
    return [...this.rows.map((r) => r.node), ...this.subs.map((s) => s.node)].filter((n) => !n.disabled).sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }

  contains(t: Node): boolean { return this.panel.contains(t) || !!this.openSub?.pop.contains(t); }

  key(e: KeyboardEvent): boolean {
    const sub = this.openSub;
    if (sub && sub.pop.panel.contains(document.activeElement)) {
      if (sub.pop.key(e)) return true;
      if (e.key === 'ArrowLeft' || e.key === 'Escape') { this.closeSub(); sub.node.focus(); return true; }
      return false;
    }
    const row = this.subs.find((s) => s.node === document.activeElement);
    if (row && (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) { this.showSub(row, true); return true; }
    return false;
  }

  closeSub(): void {
    const sub = this.openSub;
    if (!sub) return;
    this.openSub = null;
    sub.pop.closeSub();
    sub.pop.panel.hidden = true;
    setClass(sub.node, 'is-open', false);
    sub.node.setAttribute('aria-expanded', 'false');
  }

  private showSub(sub: { node: HTMLButtonElement; pop: Popup }, focusFirst: boolean): void {
    if (this.openSub !== sub) {
      this.closeSub();
      sub.pop.sync();
      const r = sub.node.getBoundingClientRect();
      const panel = sub.pop.panel;
      panel.style.visibility = 'hidden';
      panel.hidden = false;
      const w = panel.offsetWidth, h = panel.offsetHeight;
      const x = r.right + w + 4 <= window.innerWidth ? r.right + 2 : Math.max(4, r.left - w - 2);
      panel.style.left = `${Math.round(x)}px`;
      panel.style.top = `${Math.round(Math.max(4, Math.min(r.top - 6, window.innerHeight - h - 4)))}px`;
      panel.style.visibility = '';
      setClass(sub.node, 'is-open', true);
      sub.node.setAttribute('aria-expanded', 'true');
      this.openSub = sub;
    }
    if (focusFirst) sub.pop.items()[0]?.focus();
  }
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
      const pop = new Popup(commands, def.items, () => this.close(), overlay);
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
      if (this.root.contains(t) || this.popups[this.open].contains(t)) return;
      this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (this.open < 0) return;
      if (this.popups[this.open].key(e)) { e.preventDefault(); return; }
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
    if (this.open >= 0) { this.popups[this.open].closeSub(); this.popups[this.open].panel.hidden = true; setClass(this.buttons[this.open], 'is-open', false); }
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
    this.popups[this.open].closeSub();
    this.popups[this.open].panel.hidden = true;
    setClass(this.buttons[this.open], 'is-open', false);
    this.open = -1;
  }
}
