import { host, inDesktop, MENU_ENTRIES, type MenuEntry, type MenuStatus } from '../io/host';
import { el, q, setChecked, setDisabled, setText } from './dom';
import { toast } from './toast';

export class ContextMenuPanel {
  readonly root = el<HTMLElement>(`<div class="ft-osmenu">
      <h4 class="ft-osmenu-title">File manager menu</h4>
      ${MENU_ENTRIES.map(([id, label]) => `<label class="ft-row"><span class="ft-row-label">${label}</span><input type="checkbox" class="ft-check" data-menu="${id}" disabled></label>`).join('')}
      <div class="ft-row-btns ft-osmenu-btns">
        <button class="ft-btn" type="button" data-om="apply" disabled>Add to the menu</button>
        <button class="ft-btn" type="button" data-om="remove" disabled>Remove all</button>
      </div>
      <p class="ft-note ft-osmenu-note"></p>
    </div>`);

  constructor() {
    setText(q(this.root, '.ft-osmenu-note'), inDesktop() ? 'Checking the file manager...' : 'Menu entries are added from the formtools desktop app.');
    this.root.addEventListener('click', (e) => {
      const act = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-om]') : null)?.dataset.om;
      if (act === 'apply') void this.apply();
      else if (act === 'remove') void this.run(host.menuRemove());
    });
  }

  refresh(): void {
    if (!inDesktop()) return;
    void host.menuStatus().then((s) => this.paint(s));
  }

  private picked(): MenuEntry[] {
    return MENU_ENTRIES.map(([id]) => id).filter((id) => q<HTMLInputElement>(this.root, `[data-menu="${id}"]`).checked);
  }

  private async apply(): Promise<void> {
    const ids = this.picked();
    if (!ids.length) { await this.run(host.menuRemove()); return; }
    await this.run(host.menuInstall(ids));
  }

  private async run(p: Promise<MenuStatus | null>): Promise<void> {
    const s = await p;
    if (!s) { toast('The file manager menu could not be changed.', 'error'); return; }
    this.paint(s);
    toast(s.installed.length ? `formtools is in the file manager menu (${s.installed.length} entries).` : 'formtools left the file manager menu.');
  }

  private paint(s: MenuStatus | null): void {
    const ok = !!s?.supported;
    for (const [id] of MENU_ENTRIES) {
      const box = q<HTMLInputElement>(this.root, `[data-menu="${id}"]`);
      setDisabled(box, !ok);
      setChecked(box, !!s?.installed.includes(id));
    }
    setDisabled(q<HTMLButtonElement>(this.root, '[data-om="apply"]'), !ok);
    setDisabled(q<HTMLButtonElement>(this.root, '[data-om="remove"]'), !ok || !s?.installed.length);
    setText(q(this.root, '.ft-osmenu-note'), !s ? 'The file manager menu is not available.' : ok ? `Entries go to ${s.where}.` : s.reason);
  }
}
