import { api, type Capabilities } from '../../io/api';
import { el, q, setText } from '../dom';
import type { Commands } from '../commands';
import { buttonRow, valueRow } from './rows';

export class ShortcutsPanel {
  readonly el = el('<div class="cv-panel-section cv-keys"><p class="cv-note cv-keys-empty">The shortcut list appears when Preferences opens inside the app.</p></div>');
  private built = false;

  constructor(private readonly commands: Commands | undefined) {}

  refresh(): void {
    const commands = this.commands;
    if (this.built || !commands) return;
    const byGroup = new Map<string, HTMLElement[]>();
    for (const cmd of commands.all()) {
      if (!cmd.keys?.length) continue;
      const row = el(`<div class="cv-keys-row"><span class="cv-keys-name"></span><span class="cv-keys-keys"></span></div>`);
      row.title = cmd.description;
      setText(q(row, '.cv-keys-name'), cmd.label.replace(/\.\.\.$/, ''));
      const holder = q(row, '.cv-keys-keys');
      for (const k of cmd.keys) {
        const kbd = document.createElement('kbd');
        setText(kbd, commands.keyLabel({ ...cmd, keys: [k] }));
        holder.appendChild(kbd);
      }
      const list = byGroup.get(cmd.group) ?? [];
      list.push(row);
      byGroup.set(cmd.group, list);
    }
    const frag = document.createDocumentFragment();
    for (const [name, rows] of byGroup) {
      const head = el('<p class="cv-note-head"></p>');
      setText(head, name);
      frag.append(head, ...rows);
    }
    q(this.el, '.cv-keys-empty').remove();
    this.el.appendChild(frag);
    this.built = true;
  }
}

type Info = Capabilities & { dataDir?: string; data_dir?: string };

export class EnginePanels {
  readonly status = el('<div class="cv-panel-section cv-engine"></div>');
  readonly data = el('<div class="cv-panel-section cv-data"></div>');
  private readonly state = valueRow('Status');
  private readonly version = valueRow('Engine version');
  private readonly system = valueRow('System');
  private readonly tools = valueRow('Tools');
  private readonly folder = valueRow('Data folder', true);
  private readonly storage = valueRow('Preferences');
  private readonly check = buttonRow('Engine', 'Check again', () => void this.refresh());
  private busy = false;

  constructor() {
    this.status.append(this.state.el, this.version.el, this.system.el, this.tools.el, this.check.el);
    this.data.append(this.folder.el, this.storage.el);
    this.state.set('Not checked yet');
    this.version.set('-');
    this.system.set('-');
    this.tools.set('-');
    this.folder.set('');
    this.storage.set('This window, in local storage');
  }

  async refresh(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const [health, caps] = await Promise.allSettled([api.health(), api.capabilities()]);
    this.busy = false;
    const up = health.status === 'fulfilled' && health.value.ok;
    this.state.set(up ? 'Running' : 'Not reachable');
    this.version.set(health.status === 'fulfilled' ? health.value.version : '-');
    if (caps.status === 'fulfilled') {
      const c = caps.value as Info;
      this.system.set(c.os === 'macos' ? 'macOS' : c.os === 'windows' ? 'Windows' : 'Linux');
      this.tools.set(`${c.tools.length} ready`);
      this.folder.set(c.dataDir ?? c.data_dir ?? 'Not reported by this engine version');
    } else {
      this.system.set('-');
      this.tools.set('-');
      this.folder.set('Shown when the engine is running');
    }
  }
}
