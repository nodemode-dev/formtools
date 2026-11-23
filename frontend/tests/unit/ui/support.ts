import { vi } from 'vitest';
import type { Job } from '../../../src/io/api';

export interface Call { url: string; method: string; body: unknown }
export type Answer = unknown | { __status: number; body: unknown };
export type Route = (call: Call) => Answer;

export function stubEngine(routes: Record<string, Route>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    const call: Call = { url, method, body };
    calls.push(call);
    const path = url.split('?')[0];
    const route = routes[`${method} ${path}`];
    if (!route) return new Response(JSON.stringify({ ok: false, error: `no route ${method} ${path}` }), { status: 404 });
    const a = route(call);
    if (a && typeof a === 'object' && '__status' in a) {
      const r = a as { __status: number; body: unknown };
      return new Response(JSON.stringify(r.body), { status: r.__status });
    }
    return new Response(JSON.stringify(a), { status: 200 });
  });
  return calls;
}

export const refuse = (status: number, error: string): Answer => ({ __status: status, body: { ok: false, error } });

export function job(over: Partial<Job> = {}): Job {
  return { id: 'j1', kind: 'batch', title: 'Convert', state: 'running', done: 0, total: 4, current: '', errors: [], started: 100, finished: null, ...over } as Job;
}

export function toastRoot(): HTMLElement {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  return root;
}

export function shownToast(): { text: string; kind: string } | null {
  const n = toastRoot().querySelector<HTMLElement>('.cv-toast:not([hidden])');
  if (!n) return null;
  return { text: n.querySelector('.cv-toast-text')?.textContent ?? '', kind: n.dataset.kind ?? '' };
}

export function click(node: Element | null): void {
  if (!node) throw new Error('nothing to click');
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

export function type(node: HTMLInputElement | HTMLSelectElement, value: string, event: 'input' | 'change' = 'input'): void {
  node.value = value;
  node.dispatchEvent(new Event(event, { bubbles: true }));
}

export function press(node: Element, key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  node.dispatchEvent(e);
  return e;
}

export const settle = async (ms = 0): Promise<void> => { await vi.advanceTimersByTimeAsync(ms); };
