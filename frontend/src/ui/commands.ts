import { isMac } from './dom';

export interface Command {
  id: string;
  label: string;
  group: string;
  description: string;
  useWhen: string;
  keys?: string[];
  mutates?: boolean;
  run: (args?: Record<string, unknown>) => unknown;
  enabled?: () => boolean;
  checked?: () => boolean;
}

export interface CommandInfo {
  id: string;
  label: string;
  group: string;
  description: string;
  useWhen: string;
  keys: string[];
  mutates: boolean;
  enabled: boolean;
}

const MOD_NAMES: Record<string, string> = isMac
  ? { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' }
  : { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Ctrl: 'Ctrl' };

function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod) parts.push('Mod');
  if (isMac && e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  let k = e.key;
  if (k === ' ') k = 'Space';
  else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join('+');
}

export class Commands {
  private readonly byId = new Map<string, Command>();
  private readonly listeners = new Set<() => void>();

  add(...cmds: Command[]): void {
    for (const c of cmds) this.byId.set(c.id, c);
    for (const l of this.listeners) l();
  }

  get(id: string): Command | undefined { return this.byId.get(id); }

  all(): Command[] { return [...this.byId.values()]; }

  enabled(cmd: Command): boolean { return cmd.enabled ? cmd.enabled() : true; }

  label(cmd: Command): string { return cmd.label; }

  keyLabel(cmd: Command): string {
    const k = cmd.keys?.[0];
    if (!k) return '';
    return k.split('+').map((p) => MOD_NAMES[p] ?? p).join(isMac ? '' : '+');
  }

  run(id: string, args?: Record<string, unknown>): { ok: boolean; error?: string; result?: unknown } {
    const cmd = this.byId.get(id);
    if (!cmd) return { ok: false, error: `There is no command called ${id}.` };
    if (!this.enabled(cmd)) return { ok: false, error: `${cmd.label} is not available right now.` };
    try {
      return { ok: true, result: cmd.run(args) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  describe(cmd: Command): CommandInfo {
    return { id: cmd.id, label: cmd.label, group: cmd.group, description: cmd.description, useWhen: cmd.useWhen, keys: cmd.keys ?? [], mutates: !!cmd.mutates, enabled: this.enabled(cmd) };
  }

  onChange(fn: () => void): void { this.listeners.add(fn); }

  bindKeys(target: Window, skip: (e: KeyboardEvent) => boolean): void {
    target.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || skip(e)) return;
      const combo = comboOf(e);
      for (const cmd of this.byId.values()) {
        if (!cmd.keys?.includes(combo)) continue;
        if (!this.enabled(cmd)) return;
        e.preventDefault();
        cmd.run();
        return;
      }
    });
  }
}
