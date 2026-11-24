import { vi } from 'vitest';
import type { Entry } from '../../../src/io/api';
import type { DocDeps } from '../../../src/ui/docview/types';

export function entry(path: string, type: string, size = 0): Entry {
  const name = path.split('/').pop() ?? path;
  const dot = name.lastIndexOf('.');
  return { name, path, kind: 'file', ext: dot >= 0 ? name.slice(dot + 1).toLowerCase() : '', size, mtime: 0, type: type as Entry['type'] };
}

export function deps(): DocDeps & { said: string[] } {
  const said: string[] = [];
  return { said, status: (t: string) => { said.push(t); }, jobs: { track: () => undefined }, openInViewer: () => undefined };
}

export interface Routes {
  text?: Record<string, unknown>;
  csv?: Record<string, unknown>;
  raw?: Uint8Array;
}

export function stubEngine(routes: Routes): string[] {
  const seen: string[] = [];
  if (typeof (globalThis as { CSS?: unknown }).CSS === 'undefined') vi.stubGlobal('CSS', {});
  const proto = Element.prototype as unknown as { scrollIntoView?: () => void };
  if (typeof proto.scrollIntoView !== 'function') proto.scrollIntoView = () => undefined;
  vi.stubGlobal('fetch', async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    seen.push(url);
    const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith('/api/text?') && routes.text) return json(routes.text);
    if (url.startsWith('/api/data/csv?') && routes.csv) return json(routes.csv);
    if (url.startsWith('/api/file/raw?') && routes.raw) {
      const range = new Headers(init?.headers).get('Range') ?? '';
      const m = /bytes=(\d+)-(\d+)/.exec(range);
      const a = m ? Number(m[1]) : 0, b = m ? Number(m[2]) + 1 : routes.raw.length;
      return new Response(routes.raw.slice(a, b), { status: m ? 206 : 200 });
    }
    return json({ ok: false, error: 'No such thing here.' }, 404);
  });
  return seen;
}

export const textDoc = (text: string, language: string | null = null, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  encoding: 'utf-8', bom: false, eol: 'lf', lines: text.split('\n').length, text, truncated: false, language, ...extra,
});

export async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) await new Promise<void>((r) => setTimeout(r, 5));
}

export const txt = (root: ParentNode, sel: string): string => root.querySelector(sel)?.textContent ?? '';
