import { ApiError, type Job } from './api';

export interface DupeFile { path: string; size: number; mtime: number; width?: number; height?: number }
export interface DupeGroup { key: string; size: number; files: DupeFile[] }
export interface DupesResult { groups: DupeGroup[]; scanned: number; wasted: number }
export interface DupesQuery { roots: string[]; recursive: boolean; min_size: number; mode: 'exact' | 'similar-images'; threshold: number; include_hidden: boolean }

export type UsageCategory = 'images' | 'raw' | 'video' | 'audio' | 'documents' | 'code' | 'data' | 'archives' | '3d' | 'fonts' | 'apps' | 'system' | 'other';
export interface UsageNode {
  name: string; path?: string; size: number; files?: number; dirs?: number; other?: boolean; children?: UsageNode[];
  dir?: boolean; allocated?: number; types?: Partial<Record<UsageCategory, number>>; ext?: string; category?: UsageCategory;
}
export interface UsageTypeRow { category: UsageCategory; bytes: number; allocated: number; files: number }
export interface UsageExtRow { ext: string; category: UsageCategory; bytes: number; allocated: number; files: number }
export interface UsageLargest { path: string; size: number; allocated: number; mtime: number; ext: string; category: UsageCategory }
export interface UsageStats {
  by_type: UsageTypeRow[]; by_ext: UsageExtRow[]; largest: UsageLargest[];
  files: number; folders: number; errors: number; apparent: number; allocated: number; average_file: number;
  newest: number | null; oldest: number | null; hardlinks_counted_once: number; allocation: 'blocks' | 'rounded-4096';
}
export interface UsageResult extends UsageNode { errors?: number; stats?: UsageStats }

export interface HashItem { path: string; size: number; hashes: Record<string, string> }
export interface VerifyItem { path: string; expected: string; actual: string | null; ok: boolean; missing: boolean }
export interface VerifyResult { items: VerifyItem[]; ok: number; failed: number; missing: number }

export interface BrokenItem { path: string; type: string; error: string }
export interface Holder { pid: number; name: string; user: string | null }
export interface Template { name: string; path: string; kind: 'file' | 'folder' }

export const HASH_ALGOS: Array<[string, string]> = [
  ['sha256', 'SHA-256'], ['blake3', 'BLAKE3'], ['xxh64', 'XXH64'], ['sha1', 'SHA-1'], ['md5', 'MD5'], ['sha512', 'SHA-512'], ['sha3_256', 'SHA3-256'], ['crc32', 'CRC32'],
];

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

export const utilApi = {
  dupes: (query: DupesQuery) => post<Job>('/api/dupes/scan', query),
  trash: (paths: string[]) => post<{ trashed: number; errors: Array<{ path: string; error: string }> }>('/api/files/trash', { paths }),
  diskUsage: (root: string, include_hidden = false) => post<Job>('/api/diskusage/scan', { root, include_hidden }),
  emptyFolders: (root: string) => post<Job>('/api/files/empty-folders', { root }),
  broken: (root: string) => post<Job>('/api/files/broken', { root }),
  locks: (path: string) => request<{ supported: boolean; holders: Holder[] }>(`/api/files/locks?path=${encodeURIComponent(path)}`),
  templates: () => request<{ folder: string; templates: Template[] }>('/api/templates'),
  templateCreate: (template: string, folder: string, name?: string) => post<{ ok: boolean; path: string }>('/api/templates/create', name ? { template, folder, name } : { template, folder }),
  hash: (paths: string[], algorithms: string[]) => post<Job>('/api/hash', { paths, algorithms }),
  hashVerify: (path: string) => post<Job>('/api/hash/verify', { path }),
};

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 1024) return `${Math.max(0, Math.round(n || 0))} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
export const dirName = (p: string): string => p.replace(/[\\/][^\\/]*$/, '') || p;
