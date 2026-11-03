export type FileType = 'image' | 'video' | 'audio' | 'model' | 'text' | 'archive' | 'font' | 'pdf' | 'family' | 'other';

export interface Entry {
  name: string;
  path: string;
  kind: 'dir' | 'file';
  ext: string;
  size: number;
  mtime: number;
  type: FileType;
}

export interface Listing { path: string; parent: string | null; entries: Entry[] }
export interface Place { name: string; path: string }
export interface Home { home: string; roots: Place[] }

export interface Capabilities {
  version: string;
  tools: string[];
  os: 'macos' | 'windows' | 'linux';
  formats: {
    image: { native: string[]; engine: string[] };
    video: string[];
    audio: string[];
    model: string[];
    text: string[];
  };
}

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  mode: string;
  frames: number;
  animated: boolean;
  has_alpha: boolean;
  icc: string | null;
  bit_depth: number | null;
  size: number;
  mtime: number;
  exif: Record<string, string | number>;
  gps: { lat: number; lon: number } | null;
}

export type TransformOp = 'rotate-cw' | 'rotate-ccw' | 'rotate-180' | 'flip-h' | 'flip-v';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null) as (T & { ok?: boolean; error?: string }) | null;
  if (!res.ok || body === null || body.ok === false) throw new ApiError(body?.error ?? `The engine answered ${res.status}.`, res.status);
  return body;
}

const qs = (params: Record<string, string | number>): string =>
  Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');

export const api = {
  health: () => request<{ ok: boolean; app: string; version: string }>('/api/health'),
  capabilities: () => request<Capabilities>('/api/capabilities'),
  home: () => request<Home>('/api/fs/home'),
  list: (path: string, hidden = false) => request<Listing>(`/api/fs/list?${qs({ path, hidden: hidden ? 1 : 0 })}`),
  info: (path: string) => request<ImageInfo>(`/api/image/info?${qs({ path })}`),
  transform: (path: string, op: TransformOp) => request<{ ok: boolean; lossless_used: boolean; path: string }>('/api/image/transform', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, op, lossless: true }),
  }),
  rawUrl: (path: string, stamp = 0) => `/api/file/raw?${qs({ path, v: stamp })}`,
  thumbUrl: (path: string, size: number, stamp = 0) => `/api/image/thumb?${qs({ path, size, v: stamp })}`,
  viewUrl: (path: string, max = 0, stamp = 0) => `/api/image/view?${qs({ path, max, v: stamp })}`,
};
