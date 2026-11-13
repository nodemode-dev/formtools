import type { Job } from '../../io/api';
import type { Jobs } from '../jobs';
import { utilApi } from '../../io/util-api';
import { q, setDisabled, setText } from '../dom';

export async function trashAll(paths: string[]): Promise<{ trashed: number; errors: Array<{ path: string; error: string }> }> {
  const out = { trashed: 0, errors: [] as Array<{ path: string; error: string }> };
  for (let i = 0; i < paths.length; i += 5000) {
    const chunk = paths.slice(i, i + 5000);
    try {
      const r = await utilApi.trash(chunk);
      out.trashed += r.trashed;
      out.errors.push(...r.errors);
    } catch (e) {
      if (i === 0) throw e;
      const error = e instanceof Error ? e.message : 'not moved';
      out.errors.push(...chunk.map((path) => ({ path, error })));
    }
  }
  return out;
}

export interface UtilDeps {
  jobs: Jobs;
  selection: () => string[];
  folders: () => string[];
  folder: () => string;
  reveal: (path: string) => void;
  open: (path: string) => void;
  changed: () => void;
}

export function track(jobs: Jobs, job: Job, progress: (j: Job) => void): Promise<Job> {
  return new Promise((resolve) => {
    jobs.track(job, (j) => {
      progress(j);
      if (j.state !== 'running') resolve(j);
    });
  });
}

export function progressText(j: Job, noun: string): string {
  if (j.state === 'running') return j.total ? `${j.done.toLocaleString()} of ${j.total.toLocaleString()} ${noun}` : `${j.done.toLocaleString()} ${noun}`;
  if (j.state === 'cancelled') return 'Stopped.';
  if (j.state === 'failed') return j.errors[0]?.error ?? 'The scan failed.';
  return '';
}

export class RunButton {
  private job: Job | null = null;

  constructor(private readonly root: HTMLElement, label: string, private readonly cancel: (id: string) => void) {
    const run = q(root, '[data-u="run"] .ft-u-run-label');
    const stack = document.createElement('span');
    stack.className = 'ft-u-stack';
    run.replaceWith(stack);
    const stop = document.createElement('span');
    stop.className = 'ft-u-run-stop';
    setText(stop, 'Stop');
    setText(run, label);
    stack.append(run, stop);
  }

  get busy(): boolean { return this.job !== null; }

  start(job: Job): void {
    this.job = job;
    q<HTMLButtonElement>(this.root, '[data-u="run"]').dataset.mode = 'stop';
  }

  finish(): void {
    this.job = null;
    const b = q<HTMLButtonElement>(this.root, '[data-u="run"]');
    b.dataset.mode = 'run';
    setDisabled(b, false);
  }

  stop(): void { if (this.job) this.cancel(this.job.id); }
}

export function confirmButton(btn: HTMLButtonElement, ask: () => string, action: () => void): () => void {
  let armed = 0;
  const label = q(btn, '.ft-u-btn-label');
  const original = label.textContent ?? '';
  const disarm = (): void => { if (armed) { window.clearTimeout(armed); armed = 0; } setText(label, original); btn.classList.remove('is-danger'); };
  btn.addEventListener('click', () => {
    if (armed) { disarm(); action(); return; }
    setText(label, ask());
    btn.classList.add('is-danger');
    armed = window.setTimeout(disarm, 4000);
  });
  btn.addEventListener('blur', disarm);
  return disarm;
}
