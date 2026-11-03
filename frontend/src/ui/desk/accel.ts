import { isMac } from '../dom';

const MODS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'OS']);

const NAMED: Record<string, string> = {
  Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Minus: 'Minus', Equal: 'Equal', BracketLeft: 'BracketLeft', BracketRight: 'BracketRight', Backslash: 'Backslash', Semicolon: 'Semicolon',
  Quote: 'Quote', Backquote: 'Backquote', Comma: 'Comma', Period: 'Period', Slash: 'Slash',
};

const SHOWN: Record<string, string> = {
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/',
  Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right',
};

const MAC_MODS: Record<string, string> = { CommandOrControl: '⌘', Command: '⌘', Control: '⌃', Shift: '⇧', Alt: '⌥', Super: '⌘' };
const PC_MODS: Record<string, string> = { CommandOrControl: 'Ctrl', Command: 'Cmd', Control: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Super: 'Win' };

export function keyName(e: KeyboardEvent): string | null {
  if (MODS.has(e.key)) return null;
  const c = e.code;
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit[0-9]$/.test(c)) return c.slice(5);
  if (/^Numpad[0-9]$/.test(c)) return `Num${c.slice(6)}`;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(c)) return c;
  return NAMED[c] ?? null;
}

export function modifiersOf(e: KeyboardEvent): string[] {
  const out: string[] = [];
  if (isMac) {
    if (e.metaKey) out.push('CommandOrControl');
    if (e.ctrlKey) out.push('Control');
  } else {
    if (e.ctrlKey) out.push('CommandOrControl');
    if (e.metaKey) out.push('Super');
  }
  if (e.shiftKey) out.push('Shift');
  if (e.altKey) out.push('Alt');
  return out;
}

export function accelFromEvent(e: KeyboardEvent): string | null {
  const key = keyName(e);
  if (!key) return null;
  const mods = modifiersOf(e);
  if (!mods.some((m) => m !== 'Shift') && !/^F\d+$/.test(key)) return null;
  return [...mods, key].join('+');
}

export function accelLabel(accel: string): string {
  if (!accel) return '';
  const mods = isMac ? MAC_MODS : PC_MODS;
  const shown = accel.split('+').filter(Boolean).map((p) => mods[p] ?? SHOWN[p] ?? p.replace(/^Num(\d)$/, 'Num $1'));
  return shown.join(isMac ? '' : ' ');
}

export function modsLabel(mods: string[]): string {
  return accelLabel(mods.join('+'));
}
