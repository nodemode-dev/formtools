import { ApiError, type Job } from './api';

export interface ModelInfo {
  format: string;
  meshes: number;
  vertices: number;
  triangles: number;
  materials: number;
  textures: number;
  animations: number;
  nodes: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  units: string | null;
  notes: string[];
}

export type ConvertFormat = 'glb' | 'obj' | 'stl' | 'ply' | 'off';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null) as (T & { ok?: boolean; error?: string }) | null;
  if (!res.ok || body === null || body.ok === false) throw new ApiError(body?.error ?? `The engine answered ${res.status}.`, res.status);
  return body;
}

const post = <T>(path: string, body: unknown): Promise<T> => request<T>(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const qs = (params: Record<string, string | number>): string =>
  Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');

export async function fetchBytes(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const b = await res.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(b?.error ?? `The engine answered ${res.status}.`, res.status);
  }
  return res.arrayBuffer();
}

export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  return new TextDecoder().decode(await fetchBytes(url, signal));
}

export const modelApi = {
  info: (path: string) => request<ModelInfo>(`/api/model/info?${qs({ path })}`),
  rawUrl: (path: string, stamp = 0) => `/api/file/raw?${qs({ path, v: stamp })}`,
  viewUrl: (path: string, stamp = 0) => `/api/model/view?${qs({ path, v: stamp })}`,
  assetUrl: (path: string, uri: string) => `/api/model/asset?${qs({ path, uri })}`,
  convert: (path: string, format: ConvertFormat, out?: string) => post<Job>('/api/model/convert', out ? { path, format, out } : { path, format }),
};
