import { api, ApiError, type Job } from '../io/api';
import { el, escapeHtml, patchList, q, setClass, setHidden, setStyleVar, setText } from './dom';
import { icon } from './icons';
import { toast } from './toast';

type Listener = (job: Job) => void;

export class Jobs {
  readonly button = el<HTMLButtonElement>(`<button class="ft-st-jobs" type="button" aria-label="Jobs" hidden><span class="ft-st-jobs-bar"><i></i></span><span class="ft-st-jobs-text"></span></button>`);
  readonly panel = el<HTMLElement>(`<div class="cv-jobs" role="dialog" aria-label="Jobs" hidden>
      <div class="cv-jobs-head"><span>Jobs</span><button class="cv-tt-btn" type="button" data-close aria-label="Close">${icon('close', 14)}</button></div>
      <div class="cv-jobs-list"></div>
      <p class="cv-jobs-empty">No jobs yet.</p>
    </div>`);
  private readonly list = q(this.panel, '.cv-jobs-list');
  private readonly known = new Map<string, Job>();
  private readonly listeners = new Map<string, Listener[]>();
  private timer = 0;

  constructor() {
    this.button.addEventListener('click', () => this.toggle());
    this.panel.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('[data-close]')) { this.panel.hidden = true; return; }
      const stop = t?.closest<HTMLElement>('[data-stop]')?.dataset.stop;
      if (stop) void api.cancelJob(stop).then((j) => this.update(j)).catch(() => undefined);
    });
    document.addEventListener('pointerdown', (e) => {
      if (this.panel.hidden) return;
      const t = e.target as Node;
      if (!this.panel.contains(t) && !this.button.contains(t)) this.panel.hidden = true;
    });
  }

  track(job: Job, onChange?: Listener): void {
    if (onChange) this.listeners.set(job.id, [...(this.listeners.get(job.id) ?? []), onChange]);
    this.update(job);
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    const running = [...this.known.values()].some((j) => j.state === 'running');
    if (!running) return;
    this.timer = window.setTimeout(() => { this.timer = 0; void this.poll(); }, 400);
  }

  private async poll(): Promise<void> {
    const running = [...this.known.values()].filter((j) => j.state === 'running');
    await Promise.all(running.map((j) => api.job(j.id).then((n) => this.update(n)).catch((e) => {
      if (e instanceof ApiError && e.status === 404) this.update({ ...j, state: 'failed', errors: [{ path: '', error: 'the engine no longer knows this job; it may have restarted' }, ...j.errors], finished: Date.now() / 1000 });
    })));
    this.schedule();
  }

  private update(job: Job): void {
    const prev = this.known.get(job.id);
    this.known.set(job.id, job);
    for (const l of this.listeners.get(job.id) ?? []) l(job);
    if (prev?.state === 'running' && job.state !== 'running') {
      const errs = job.errors.length;
      if (job.state === 'done') toast(`${job.title}: done${errs ? `, ${errs} could not be processed` : ''}.`, errs ? 'error' : 'info');
      else if (job.state === 'failed') toast(`${job.title} failed: ${job.errors[0]?.error ?? 'unknown error'}.`, 'error');
      else toast(`${job.title} stopped.`);
    }
    this.render();
  }

  private render(): void {
    const all = [...this.known.values()].sort((a, b) => b.started - a.started).slice(0, 20);
    const running = all.filter((j) => j.state === 'running');
    setHidden(this.button, all.length === 0);
    const lead = running[0];
    const pct = lead && lead.total ? Math.round((lead.done / lead.total) * 100) : 100;
    setStyleVar(q(this.button, 'i'), '--p', `${pct}%`);
    setClass(this.button, 'is-busy', running.length > 0);
    setText(q(this.button, '.ft-st-jobs-text'), running.length ? `${running.length} running · ${lead.done} of ${lead.total}` : `${all.length} job${all.length === 1 ? '' : 's'}`);
    setHidden(q(this.panel, '.cv-jobs-empty'), all.length > 0);
    const update = (n: HTMLElement, j: Job): void => {
      const p = j.total ? Math.round((j.done / j.total) * 100) : j.state === 'running' ? 0 : 100;
      setText(q(n, '.cv-jobs-name'), j.title);
      setText(q(n, '.cv-jobs-pct'), j.state === 'running' ? `${p}%` : j.state === 'done' ? (j.errors.length ? `${j.errors.length} errors` : 'Done') : j.state === 'failed' ? 'Failed' : 'Stopped');
      setStyleVar(q(n, '.cv-jobs-bar > i'), '--p', `${p}%`);
      const stop = q<HTMLButtonElement>(n, '.cv-jobs-stop');
      stop.disabled = j.state !== 'running';
      n.title = j.current || '';
    };
    patchList(this.list, all, {
      key: (j) => j.id,
      create: (j) => { const n = el<HTMLElement>(`<div class="cv-jobs-row"><span class="cv-jobs-name"></span><span class="cv-jobs-bar"><i></i></span><span class="cv-jobs-pct"></span><button class="cv-jobs-stop" type="button" data-stop="${escapeHtml(j.id)}">Stop</button></div>`); update(n, j); return n; },
      update,
    });
  }

  private toggle(): void {
    if (!this.panel.hidden) { this.panel.hidden = true; return; }
    const r = this.button.getBoundingClientRect();
    this.panel.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
    this.panel.style.bottom = `${Math.round(window.innerHeight - r.top + 6)}px`;
    this.panel.hidden = false;
  }
}
