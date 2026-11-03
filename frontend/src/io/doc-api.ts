import { ApiError, api, type Job } from './api';

export interface TextDoc {
  encoding: string;
  bom: boolean;
  eol: 'lf' | 'crlf' | 'cr' | 'mixed';
  lines: number;
  text: string;
  truncated: boolean;
  language: string | null;
}

export interface CsvDoc {
  delimiter: string;
  header: string[] | null;
  rows: string[][];
  total_rows: number;
  truncated: boolean;
}

export interface SqlColumn { name: string; type: string; pk: boolean }
export interface SqlTable { name: string; kind: 'table' | 'view'; rows: number; columns: SqlColumn[] }
export type SqlCell = string | number | null | { blob: number };
export interface SqlRows { columns: string[]; rows: SqlCell[][]; total: number }

export interface FontAxis { tag: string; name: string; min: number; default: number; max: number }
export interface FontInfo {
  family: string;
  subfamily: string;
  full_name: string;
  postscript: string;
  version: string;
  designer: string;
  vendor: string;
  license: string;
  license_url: string;
  copyright: string;
  glyphs: number;
  format: string;
  faces: number;
  axes: FontAxis[];
  features: string[];
  scripts: string[];
  coverage: Array<{ block: string; count: number }>;
  installed: boolean;
}

export interface ArchiveEntry {
  name: string;
  member: string;
  size: number;
  packed: number;
  mtime: number;
  dir: boolean;
  encrypted: boolean;
  link: boolean;
}
export interface ArchiveListing {
  format: string;
  entries: ArchiveEntry[];
  total: number;
  truncated: boolean;
  engine: string;
}

export type HashAlgo = 'md5' | 'sha1' | 'sha256' | 'sha512' | 'sha3_256' | 'blake3' | 'xxh64' | 'crc32';
export interface HashResult { items: Array<{ path: string; size: number; hashes: Record<string, string> }> }
export interface ExtractResult { dest: string; written: number; skipped: number }

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

async function bytes(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const b = await res.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(b?.error ?? `The engine answered ${res.status}.`, res.status);
  }
  return res;
}

export const docApi = {
  text: (path: string, max = 2097152) => request<TextDoc>(`/api/text?${qs({ path, max })}`),
  csv: (path: string, limit = 5000) => request<CsvDoc>(`/api/data/csv?${qs({ path, limit })}`),
  sqliteTables: (path: string) => request<{ tables: SqlTable[] }>(`/api/data/sqlite/tables?${qs({ path })}`),
  sqliteRows: (path: string, table: string, offset: number, limit = 200) => request<SqlRows>(`/api/data/sqlite/rows?${qs({ path, table, offset, limit })}`),
  fontInfo: (path: string) => request<FontInfo>(`/api/font/info?${qs({ path })}`),
  fontInstall: (path: string) => post<{ ok: boolean; path: string }>('/api/font/install', { path }),
  archiveList: (path: string, limit = 20000) => request<ArchiveListing>(`/api/archive/list?${qs({ path, limit })}`),
  archiveMemberUrl: (path: string, member: string) => `/api/archive/member?${qs({ path, member })}`,
  archiveMember: async (path: string, member: string): Promise<Blob> => (await bytes(`/api/archive/member?${qs({ path, member })}`)).blob(),
  archiveExtract: (path: string, members?: string[], dest?: string) => post<Job>('/api/archive/extract', { path, ...(dest ? { dest } : {}), ...(members ? { members } : {}) }),
  hash: (paths: string[], algorithms: HashAlgo[]) => post<Job>('/api/hash', { paths, algorithms }),
  range: async (path: string, start: number, end: number, stamp = 0): Promise<Uint8Array> => {
    const res = await bytes(api.rawUrl(path, stamp), { headers: { Range: `bytes=${start}-${end - 1}` } });
    const buf = new Uint8Array(await res.arrayBuffer());
    if (res.status === 206) return buf;
    return buf.subarray(start, end);
  },
  rawUrl: (path: string, stamp = 0) => api.rawUrl(path, stamp),
};
