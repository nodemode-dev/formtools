import type { Commands } from './commands';
import type { MenuDef, MenuItem } from './menu';

export const MENUS_IN_WINDOW_KEY = 'formtools.menusInWindow';

export function menusInWindow(): boolean {
  try { return localStorage.getItem(MENUS_IN_WINDOW_KEY) === '1'; } catch { return false; }
}

export const wantsNativeMenus = (): boolean => '__TAURI_INTERNALS__' in window && /Mac/.test(navigator.platform) && !menusInWindow();

export function accelerator(combo: string | undefined): string | null {
  if (!combo) return null;
  const names: Record<string, string> = { Mod: 'CmdOrCtrl', Alt: 'Alt', Shift: 'Shift', Ctrl: 'Ctrl', Delete: 'Delete', Backspace: 'Backspace', Escape: 'Escape', Enter: 'Enter', Tab: 'Tab', Space: 'Space', '=': '=', '-': '-', ',': ',', '0': '0' };
  const out: string[] = [];
  for (const p of combo.split('+')) {
    if (names[p]) out.push(names[p]);
    else if (/^[A-Za-z0-9]$/.test(p)) out.push(p.toUpperCase());
    else if (/^F([1-9]|1[0-2])$/.test(p)) out.push(p);
    else return null;
  }
  return out.join('+');
}

const TEXT_EDITS = new Set(['undo', 'redo', 'cut', 'copy', 'paste', 'select-all']);

function textFieldFocused(): boolean {
  const a = document.activeElement;
  if (a instanceof HTMLTextAreaElement) return !a.readOnly && !a.disabled;
  if (a instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'range', 'color', 'file'].includes(a.type) && !a.readOnly;
  return a instanceof HTMLElement && a.isContentEditable;
}

type Api = typeof import('@tauri-apps/api/menu');
type Item = { setEnabled(on: boolean): Promise<void>; setChecked?(on: boolean): Promise<void> };

export class NativeMenus {
  private items: Array<{ id: string; item: Item }> = [];
  private timer = 0;

  constructor(private readonly commands: Commands, private readonly menus: MenuDef[]) {
    for (const ev of ['pointerup', 'keyup', 'focusin', 'focusout'] as const) window.addEventListener(ev, () => this.refresh(), { passive: true });
  }

  async build(): Promise<void> {
    const api: Api = await import('@tauri-apps/api/menu');
    const items: typeof this.items = [];
    const make = async (spec: MenuItem): Promise<unknown> => {
      if (spec === '-') return api.PredefinedMenuItem.new({ item: 'Separator' });
      if (typeof spec === 'object') return api.Submenu.new({ text: spec.label, items: (await Promise.all(spec.items.map(make))).filter(Boolean) as never[] });
      const cmd = this.commands.get(spec);
      if (!cmd) return null;
      const acc = accelerator(cmd.keys?.[0]);
      const opts = {
        text: cmd.label,
        enabled: this.enabled(spec),
        action: () => {
          if (TEXT_EDITS.has(spec) && textFieldFocused()) void import('@tauri-apps/api/core').then((m) => m.invoke('text_edit', { action: spec })).catch(() => undefined);
          else this.commands.run(spec);
          this.refresh();
        },
      };
      let item: Item;
      if (cmd.checked) {
        const c = { ...opts, checked: !!cmd.checked() };
        try { item = await api.CheckMenuItem.new(acc ? { ...c, accelerator: acc } : c); } catch { item = await api.CheckMenuItem.new(c); }
      } else {
        try { item = await api.MenuItem.new(acc ? { ...opts, accelerator: acc } : opts); } catch { item = await api.MenuItem.new(opts); }
      }
      items.push({ id: spec, item });
      return item;
    };
    const top: unknown[] = [];
    top.push(await api.Submenu.new({ text: 'formtools', items: [
      await api.PredefinedMenuItem.new({ item: { About: { name: 'formtools' } }, text: 'About formtools' }),
      await api.PredefinedMenuItem.new({ item: 'Separator' }),
      ...(this.commands.get('settings') ? [await make('settings')] : []),
      await api.PredefinedMenuItem.new({ item: 'Separator' }),
      await api.PredefinedMenuItem.new({ item: 'Hide' }),
      await api.PredefinedMenuItem.new({ item: 'Quit' }),
    ] as never[] }));
    for (const def of this.menus) {
      const list = (await Promise.all(def.items.filter((i) => i !== 'settings').map(make))).filter(Boolean);
      top.push(await api.Submenu.new({ text: def.label, items: list as never[] }));
    }
    const menu = await api.Menu.new({ items: top as never[] });
    await menu.setAsAppMenu();
    this.items = items;
    document.documentElement.classList.add('has-native-menus');
  }

  private enabled(id: string): boolean {
    if (TEXT_EDITS.has(id) && textFieldFocused()) return true;
    const cmd = this.commands.get(id);
    return !!cmd && this.commands.enabled(cmd);
  }

  refresh(): void {
    if (this.timer || !this.items.length) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      for (const { id, item } of this.items) {
        const cmd = this.commands.get(id);
        if (!cmd) continue;
        void item.setEnabled(this.enabled(id)).catch(() => undefined);
        if (cmd.checked && item.setChecked) void item.setChecked(!!cmd.checked()).catch(() => undefined);
      }
    }, 150);
  }
}
