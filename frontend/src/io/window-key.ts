const HEADER = 'X-Formtools-Window-Key';
const STORE = 'formtools-window-key';

let key = '';

function remembered(): string {
  try { return sessionStorage.getItem(STORE) ?? ''; } catch { return ''; }
}

function remember(value: string): void {
  try { sessionStorage.setItem(STORE, value); } catch { return; }
}

async function accepted(): Promise<boolean> {
  try { return (await fetch('/api/terminal', { headers: { [HEADER]: key } })).ok; } catch { return false; }
}

export async function loadWindowKey(): Promise<void> {
  const holder = window as unknown as { __FORMTOOLS_WINDOW_KEY?: unknown };
  const given = holder.__FORMTOOLS_WINDOW_KEY;
  delete holder.__FORMTOOLS_WINDOW_KEY;
  if (typeof given === 'string' && given) { key = given; return; }
  key = remembered();
  if (key && await accepted()) return;
  key = '';
  try {
    const res = await fetch('/api/window/key', { method: 'POST' });
    const body = res.ok ? await res.json() as { key?: unknown } : {};
    if (typeof body.key === 'string' && body.key) { key = body.key; remember(key); return; }
  } catch { key = ''; }
  key = remembered();
}

export const windowKey = (): string => key;

export function keyed(init?: RequestInit): RequestInit {
  if (!key) return init ?? {};
  const headers = new Headers(init?.headers);
  headers.set(HEADER, key);
  return { ...init, headers };
}
