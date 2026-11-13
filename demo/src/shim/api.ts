interface Answer { s: number; j?: unknown; t?: string; b?: number }
interface Recording { demo: string; root: string; home: unknown; answers: Record<string, Answer | undefined>; bin: string[] }

declare global { interface Window { FT_RECORDING?: Recording } }

export const NEEDS = 'This needs the formtools engine. This page only replays answers recorded from the engine for its demo folder; other folders, your own files, anything that writes files, the terminal and Claude Code need formtools running on your computer.';
const IGNORED = new Set(['v', 'size', 'max', 'points', 'limit', 'hidden']);
const EMPTY = 'data:,';

const rec = (): Recording => window.FT_RECORDING ?? { demo: '', root: '', home: null, answers: {}, bin: [] };

function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canon((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

const own = (raw: string): string | null => {
  if (raw.startsWith('/api/')) return raw;
  const m = /^file:\/\/(?:\/[A-Za-z]:)?(\/api\/.*)$/.exec(raw);
  return m ? m[1] : null;
};

function keyOf(method: string, url: string, body: unknown): string {
  const [path, query = ''] = url.split('?');
  const pairs = [...new URLSearchParams(query)].filter(([k]) => !IGNORED.has(k)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const q = pairs.map(([k, v]) => `${k}=${v}`).join('&');
  return `${method} ${path}${q ? `?${q}` : ''}${body === undefined ? '' : ` ${canon(body)}`}`;
}

const blobs = new Map<number, Blob>();
const urls = new Map<number, string>();

function blobOf(a: Answer): Blob {
  const i = a.b ?? -1;
  let b = blobs.get(i);
  if (!b) {
    const text = atob(rec().bin[i] ?? '');
    const bytes = new Uint8Array(text.length);
    for (let n = 0; n < text.length; n++) bytes[n] = text.charCodeAt(n);
    b = new Blob([bytes], { type: a.t ?? 'application/octet-stream' });
    blobs.set(i, b);
  }
  return b;
}

function urlOf(raw: string): string {
  const a = rec().answers[keyOf('GET', raw, undefined)];
  if (!a || a.s !== 200 || a.b === undefined) return EMPTY;
  let u = urls.get(a.b);
  if (!u) { u = URL.createObjectURL(blobOf(a)); urls.set(a.b, u); }
  return u;
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function answer(method: string, url: string, body: unknown): Response {
  const r = rec();
  const path = url.split('?')[0];
  if (path === '/api/health') return json({ ok: true, app: 'formtools', version: 'replay' });
  if (path === '/api/fs/home' && r.home) return json(r.home);
  if (path === '/api/meta/read') {
    const all = (r.answers['POST /api/meta/read']?.j as { items?: Record<string, unknown> } | undefined)?.items ?? {};
    const paths = (body as { paths?: string[] } | undefined)?.paths ?? [];
    return json({ items: Object.fromEntries(paths.filter((p) => p in all).map((p) => [p, all[p]])) });
  }
  const a = r.answers[keyOf(method, url, body)];
  if (!a) return json({ ok: false, error: NEEDS }, 503);
  if (a.b === undefined) return json(a.j, a.s);
  return new Response(blobOf(a), { status: a.s, headers: { 'Content-Type': a.t ?? 'application/octet-stream' } });
}

function bodyOf(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') return undefined;
  try { return JSON.parse(init.body); } catch { return init.body; }
}

const native = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = own(raw);
  if (!url) return native(input, init);
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  return Promise.resolve(answer(method, url, bodyOf(init)));
};

const logical = new WeakMap<Element, string>();
const swap = (proto: object, prop: string): void => {
  const d = Object.getOwnPropertyDescriptor(proto, prop);
  if (!d?.set || !d.get) return;
  Object.defineProperty(proto, prop, {
    configurable: true,
    enumerable: d.enumerable,
    get(this: Element) { return d.get!.call(this); },
    set(this: Element, value: string) {
      const url = own(String(value));
      if (url) { if (prop === 'src') logical.set(this, String(value)); d.set!.call(this, urlOf(url)); return; }
      if (prop === 'src') logical.delete(this);
      d.set!.call(this, value);
    },
  });
};
swap(HTMLImageElement.prototype, 'src');
swap(HTMLMediaElement.prototype, 'src');
swap(HTMLTrackElement.prototype, 'src');
swap(HTMLSourceElement.prototype, 'src');
swap(HTMLVideoElement.prototype, 'poster');

const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
if (html?.set && html.get) {
  const set = html.set;
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true,
    enumerable: html.enumerable,
    get: html.get,
    set(this: Element, value: string) {
      const text = String(value);
      set.call(this, text.includes('/api/') ? text.replace(/(\s(?:src|poster)=")(\/api\/[^"]*)"/g, (_all, head: string, url: string) => `${head}${urlOf(url.replace(/&amp;/g, '&'))}"`) : text);
    },
  });
}

const getAttribute = Element.prototype.getAttribute;
Element.prototype.getAttribute = function (this: Element, name: string): string | null {
  if (name === 'src') { const l = logical.get(this); if (l !== undefined && getAttribute.call(this, 'src') !== null) return l; }
  return getAttribute.call(this, name);
};
const removeAttribute = Element.prototype.removeAttribute;
Element.prototype.removeAttribute = function (this: Element, name: string): void {
  if (name === 'src') logical.delete(this);
  removeAttribute.call(this, name);
};

const NativeFace = window.FontFace;
window.FontFace = new Proxy(NativeFace, {
  construct(target, args: ConstructorParameters<typeof FontFace>) {
    const [family, source, desc] = args;
    if (typeof source === 'string') {
      const m = /url\(["']?([^"')]+)["']?\)/.exec(source);
      const url = m ? own(m[1]) : null;
      if (url) return new target(family, `url("${urlOf(url)}")`, desc);
    }
    return new target(family, source, desc);
  },
});

const nothing = URL.createObjectURL(new Blob([]));
const open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, async: boolean = true, user?: string | null, password?: string | null): void {
  const u = own(String(url));
  const to = u ? urlOf(u) : String(url).includes('/pdfjs/') ? EMPTY : null;
  open.call(this, method, to === null ? url : to === EMPTY ? nothing : to, async, user, password);
};

class QuietSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = 0;
  binaryType: BinaryType = 'blob';
  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: Event) => void) | null = null;
  constructor(readonly url: string) {
    super();
    window.setTimeout(() => { this.readyState = 3; const e = new CloseEvent('close', { code: 1000, reason: NEEDS }); this.onclose?.(e); this.dispatchEvent(e); }, 0);
  }
  send(): void { return; }
  close(): void { this.readyState = 3; }
}

const NativeSocket = window.WebSocket;
window.WebSocket = new Proxy(NativeSocket, {
  construct(target, args: ConstructorParameters<typeof WebSocket>) {
    const url = String(args[0]);
    return url.includes('/api/') ? new QuietSocket(url) as unknown as WebSocket : new target(...args);
  },
});
