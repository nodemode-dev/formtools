import { ApiError } from './api';

export interface HostEntry { line?: number; enabled: boolean; address: string; names: string[]; comment: string }
export interface HostsInfo { path: string; writable: boolean; entries: HostEntry[]; raw: string }
export interface HostsSaved { ok: boolean; backup: string; elevated: boolean }

export type EnvScopeId = 'process' | 'user' | 'system';
export interface EnvVar { name: string; value: string }
export interface EnvScope { id: EnvScopeId; editable: boolean; where: string; vars: EnvVar[] }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null) as (T & { ok?: boolean; error?: string }) | null;
  if (res.status === 404 && body === null) throw new ApiError('This build of the engine does not include the desktop tool.', 404);
  if (!res.ok || body === null || body.ok === false) throw new ApiError(body?.error ?? `The engine answered ${res.status}.`, res.status);
  return body;
}

const post = <T>(path: string, body: unknown): Promise<T> => request<T>(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const desktopApi = {
  hosts: () => request<HostsInfo>('/api/hosts'),
  saveHosts: (entries: HostEntry[]) => post<HostsSaved>('/api/hosts', { entries }),
  env: () => request<{ scopes: EnvScope[] }>('/api/env'),
  setEnv: (scope: EnvScopeId, name: string, value: string | null) => post<{ ok: boolean }>('/api/env', { scope, name, value }),
};
