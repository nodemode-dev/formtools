import { ApiError, type Job } from './api';

export interface ExifStatus {
  available: boolean;
  path: string | null;
  version: string | null;
  source: 'env' | 'path' | 'fetched' | null;
  fetching: boolean;
  perl: boolean | string | null;
  error: string | null;
}

export type ExifValue = string | number | boolean | null | ExifValue[] | { [key: string]: ExifValue };

export interface ExifTag { name: string; label: string; value: ExifValue }
export interface ExifGroup { name: string; family0: string; tags: ExifTag[] }
export interface ExifFile { name: string; size: number; type: string; mime: string }

export interface ExifRead {
  tool: string;
  version: string;
  file: ExifFile;
  groups: ExifGroup[];
  count: number;
  warnings: string[];
}

export interface ExifReadOptions { numeric?: boolean; unknown?: boolean; signal?: AbortSignal }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null) as (T & { ok?: boolean; error?: string }) | null;
  if (!res.ok || body === null || body.ok === false) throw new ApiError(body?.error ?? `The engine answered ${res.status}.`, res.status);
  return body;
}

const qs = (params: Record<string, string | number>): string =>
  Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');

export const exifApi = {
  status: (signal?: AbortSignal) => request<ExifStatus>('/api/exif/status', { signal }),
  fetch: () => request<Job>('/api/exif/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  read: (path: string, opts: ExifReadOptions = {}) =>
    request<ExifRead>(`/api/exif/read?${qs({ path, numeric: opts.numeric ? 1 : 0, unknown: opts.unknown ? 1 : 0 })}`, { signal: opts.signal }),
};
