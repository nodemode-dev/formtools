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
  iptc?: Record<string, string | string[]>;
  xmp?: { rating?: number | null; label?: string | null; title?: string; description?: string; keywords?: string[]; creator?: string; rights?: string };
}

export type TransformOp = 'rotate-cw' | 'rotate-ccw' | 'rotate-180' | 'flip-h' | 'flip-v';

export type Label = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'grey';
export interface Tag { rating: number; label: Label | null }

export type EditOp =
  | { op: 'crop'; x: number; y: number; w: number; h: number }
  | { op: 'resize'; width: number; height: number; resample: 'lanczos' | 'bicubic' | 'bilinear' | 'nearest' }
  | { op: 'rotate'; degrees: 90 | 180 | 270 }
  | { op: 'flip'; axis: 'h' | 'v' };

export interface EditOut { path?: string; format?: 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'; quality?: number }

export interface Dir { name: string; path: string; has_children: boolean }

export interface ActionParam {
  key: string;
  label: string;
  type: 'int' | 'float' | 'bool' | 'choice' | 'text' | 'color' | 'path';
  min?: number;
  max?: number;
  step?: number;
  default: unknown;
  options?: Array<[string, string]>;
}
export interface ActionDef { id: string; group: string; label: string; params: ActionParam[] }
export interface ActionUse { id: string; params: Record<string, unknown> }

export interface BatchOutput {
  format: 'same' | 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff' | 'bmp' | 'gif';
  quality: number;
  folder: string;
  subfolder: string;
  naming: string;
  overwrite: 'skip' | 'replace' | 'rename';
  keep_metadata: boolean;
  keep_folders: boolean;
  keep_dates: boolean;
}

export interface BatchInputs { inputs: string[]; recursive: boolean; extensions: string[] }
export interface PlanItem { src: string; dst: string; conflict: 'none' | 'exists' | 'duplicate' | 'invalid'; changed?: boolean }
export interface Preset { name: string; actions: ActionUse[]; output: BatchOutput }

export type RenameRule = Record<string, unknown> & { type: string };

export interface Job {
  id: string;
  kind: string;
  title: string;
  state: 'running' | 'done' | 'failed' | 'cancelled';
  done: number;
  total: number;
  current: string;
  errors: Array<{ path: string; error: string }>;
  result: unknown;
  started: number;
  finished: number | null;
}

export interface MediaStream {
  index: number;
  type: 'video' | 'audio' | 'subtitle' | 'data' | 'attachment';
  codec: string;
  codec_long?: string;
  profile?: string | null;
  width?: number;
  height?: number;
  fps?: number | null;
  pix_fmt?: string | null;
  bit_depth?: number | null;
  hdr?: { transfer?: string; primaries?: string; matrix?: string } | null;
  channels?: number;
  layout?: string | null;
  sample_rate?: number;
  bit_rate?: number | null;
  language?: string | null;
  title?: string | null;
  default?: boolean;
  forced?: boolean;
}

export interface MediaInfo {
  format: { name: string; long_name?: string; duration: number | null; bit_rate: number | null; size: number; tags: Record<string, string> };
  streams: MediaStream[];
  chapters: Array<{ start: number; end: number; title: string }>;
  playable: { native: boolean; remux: boolean };
}

export interface MediaStatus { ffmpeg: string | null; ffprobe: string | null; version: string | null; fetching: boolean; error: string | null }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null) as (T & { ok?: boolean; error?: string }) | null;
  if (!res.ok || body === null || body.ok === false) throw new ApiError(body?.error ?? `The engine answered ${res.status}.`, res.status);
  return body;
}

const post = <T>(path: string, body: unknown, method = 'POST'): Promise<T> => request<T>(path, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

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
  dirs: (path: string, hidden = false) => request<{ path: string; dirs: Dir[] }>(`/api/fs/dirs?${qs({ path, hidden: hidden ? 1 : 0 })}`),
  metaRead: (paths: string[]) => post<{ items: Record<string, Tag> }>('/api/meta/read', { paths }),
  metaWrite: (path: string, change: Partial<Tag>) => post<Tag>('/api/meta/write', { path, ...change }),
  edit: (path: string, ops: EditOp[], out: EditOut, overwrite = false) => post<{ ok: boolean; path: string }>('/api/image/edit', { path, ops, out, overwrite }),
  batchActions: () => request<{ actions: ActionDef[] }>('/api/batch/actions'),
  batchPreviewUrl: async (path: string, actions: ActionUse[], max: number): Promise<string> => {
    const res = await fetch('/api/batch/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, actions, max }) });
    if (!res.ok) {
      const b = await res.json().catch(() => null) as { error?: string } | null;
      throw new ApiError(b?.error ?? `The engine answered ${res.status}.`, res.status);
    }
    return URL.createObjectURL(await res.blob());
  },
  batchPlan: (inputs: BatchInputs, output: BatchOutput, actions: ActionUse[] = []) => post<{ items: PlanItem[]; skipped: Array<{ path: string; reason: string }> }>('/api/batch/plan', { ...inputs, output, actions }),
  batchRun: (inputs: BatchInputs, actions: ActionUse[], output: BatchOutput) => post<Job>('/api/batch/run', { ...inputs, actions, output }),
  presets: () => request<{ presets: Preset[] }>('/api/batch/presets'),
  savePreset: (name: string, actions: ActionUse[], output: BatchOutput) => post<unknown>(`/api/batch/presets/${encodeURIComponent(name)}`, { actions, output }, 'PUT'),
  deletePreset: (name: string) => request<unknown>(`/api/batch/presets/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  renamePlan: (paths: string[], rules: RenameRule[]) => post<{ items: PlanItem[] }>('/api/rename/plan', { paths, rules }),
  renameApply: (paths: string[], rules: RenameRule[]) => post<{ ok: boolean; renamed: number; undo: string }>('/api/rename/apply', { paths, rules }),
  renameUndo: (undo: string) => post<{ ok: boolean }>('/api/rename/undo', { undo }),
  jobs: () => request<{ jobs: Job[] }>('/api/jobs'),
  job: (id: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`),
  cancelJob: (id: string) => post<Job>(`/api/jobs/${encodeURIComponent(id)}/cancel`, {}),
  mediaStatus: () => request<MediaStatus>('/api/media/status'),
  mediaInfo: (path: string) => request<MediaInfo>(`/api/media/info?${qs({ path })}`),
  waveform: (path: string, points: number) => request<{ duration: number; peaks: number[] }>(`/api/media/waveform?${qs({ path, points })}`),
  subtitles: (path: string) => request<{ embedded: Array<{ index: number; language: string | null; title: string | null; codec: string }>; external: string[] }>(`/api/media/subtitles?${qs({ path })}`),
  snapshot: (path: string, time: number) => post<{ ok: boolean; path: string }>('/api/media/snapshot', { path, time }),
  mediaCopy: (path: string, op: 'remux' | 'trim' | 'extract-audio', extra: Record<string, unknown> = {}) => post<Job>('/api/media/copy', { path, op, ...extra }),
  mediaThumbUrl: (path: string, size: number, stamp = 0) => `/api/media/thumb?${qs({ path, size, v: stamp })}`,
  streamUrl: (path: string, stamp = 0) => `/api/media/stream?${qs({ path, v: stamp })}`,
  subtitleUrl: (path: string, index: number) => `/api/media/subtitle?${qs({ path, index })}`,
  subtitleFileUrl: (path: string, file: string) => `/api/media/subtitle?${qs({ path, file })}`,
  rawUrl: (path: string, stamp = 0) => `/api/file/raw?${qs({ path, v: stamp })}`,
  thumbUrl: (path: string, size: number, stamp = 0) => `/api/image/thumb?${qs({ path, size, v: stamp })}`,
  viewUrl: (path: string, max = 0, stamp = 0) => `/api/image/view?${qs({ path, max, v: stamp })}`,
};
