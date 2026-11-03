import type { Entry, Job } from '../../io/api';

export interface JobsLike {
  track(job: unknown, cb?: (j: Job) => void): void;
}

export interface DocDeps {
  status: (t: string) => void;
  jobs: JobsLike;
  openInViewer: (entries: Entry[], index: number) => void;
}

export interface DocKind {
  readonly root: HTMLElement;
  open(entry: Entry): Promise<void>;
  close(): void;
  key(e: KeyboardEvent): boolean;
  shown?(): void;
}

export type KindName = 'text' | 'markdown' | 'csv' | 'json' | 'sqlite' | 'pdf' | 'font' | 'hex' | 'archive' | 'checksum';
