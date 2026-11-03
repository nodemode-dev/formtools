import { api, type Job } from '../../io/api';
import { baseName, utilApi, type BrokenItem } from '../../io/util-api';
import { el, escapeHtml, patchList, q, setChecked, setClass, setDisabled, setHidden, setText, setValue } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import { confirmButton, progressText, track, type UtilDeps } from './common';

interface Row { path: string; note: string }
type Mode = 'empty' | 'broken';

export class CleanupView {
  readonly root = el<HTMLElement>(`<div class="ft-util-view ft-cu" data-util="cleanup" hidden>
      <div class="ft-du-bar">
        <input type="text" class="ft-input ft-cu-path" spellcheck="false" placeholder="Folder to check" aria-label="Folder to check">
        <button class="ft-btn" type="button" data-cu="here">Current folder</button>
        <span class="ft-run-state"></span>
        <button class="ft-btn" type="button" data-cu="empty">${icon('folder', 14)} Find empty folders</button>
        <button class="ft-btn" type="button" data-cu="broken">${icon('warning', 14)} Find broken files</button>
      </div>
      <section class="ft-panel ft-util-results ft-cu-results">
        <header class="ft-panel-head"><span class="ft-panel-title ft-cu-title">Clean up</span><span class="ft-panel-count ft-cu-sum"></span>
          <button class="ft-btn" type="button" data-cu="all" disabled>Select all</button>
          <button class="ft-btn" type="button" data-cu="trash" disabled>${icon('ftTrash', 14)} <span class="ft-u-btn-label">Move to trash</span></button></header>
        <p class="ft-note ft-cu-empty">Empty folders hold no files anywhere inside them. Broken files are pictures that do not decode and media files the media reader rejects.</p>
        <div class="ft-cu-list"></div>
      </section>
    </div>`);
  private rows: Row[] = [];
  private mode: Mode = 'empty';
  private readonly picked = new Set<string>();
  private job: Job | null = null;

  constructor(private readonly deps: UtilDeps) {
    const list = q(this.root, '.ft-cu-list');
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const act = t?.closest<HTMLElement>('[data-cu]')?.dataset.cu;
      if (act === 'here') setValue(q<HTMLInputElement>(this.root, '.ft-cu-path'), this.deps.folder());
      else if (act === 'empty' || act === 'broken') { if (this.job) void api.cancelJob(this.job.id).catch(() => undefined); else void this.scan(act); }
      else if (act === 'all') { const all = this.picked.size < this.rows.length; this.picked.clear(); if (all) for (const r of this.rows) this.picked.add(r.path); this.render(); }
      const rev = t?.closest<HTMLElement>('[data-reveal]')?.dataset.reveal;
      if (rev) this.deps.reveal(rev);
    });
    list.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !t.dataset.pick) return;
      if (t.checked) this.picked.add(t.dataset.pick); else this.picked.delete(t.dataset.pick);
      this.syncButtons();
    });
    confirmButton(q<HTMLButtonElement>(this.root, '[data-cu="trash"]'), () => `Move ${this.picked.size} to the trash?`, () => void this.trash());
  }

  show(inputs?: string[]): void {
    const p = q<HTMLInputElement>(this.root, '.ft-cu-path');
    if (!p.value) setValue(p, inputs?.[0] ?? this.deps.folder());
  }

  private async scan(mode: Mode): Promise<void> {
    const root = q<HTMLInputElement>(this.root, '.ft-cu-path').value.trim();
    if (!root) { toast('Type a folder path first.', 'error'); return; }
    const state = q(this.root, '.ft-run-state');
    const other = q<HTMLButtonElement>(this.root, `[data-cu="${mode === 'empty' ? 'broken' : 'empty'}"]`);
    try {
      const job = mode === 'empty' ? await utilApi.emptyFolders(root) : await utilApi.broken(root);
      this.job = job;
      setDisabled(other, true);
      setClass(q(this.root, `[data-cu="${mode}"]`), 'is-running', true);
      const end = await track(this.deps.jobs, job, (j) => setText(state, progressText(j, 'items')));
      this.job = null;
      setDisabled(other, false);
      setClass(q(this.root, `[data-cu="${mode}"]`), 'is-running', false);
      if (end.state !== 'done') return;
      setText(state, '');
      this.mode = mode;
      this.rows = mode === 'empty'
        ? (end.result as { folders: string[] }).folders.map((p) => ({ path: p, note: 'Empty folder' }))
        : (end.result as { items: BrokenItem[] }).items.map((i) => ({ path: i.path, note: `${i.type}: ${i.error}` }));
      this.picked.clear();
      this.render();
    } catch (e) {
      this.job = null;
      setDisabled(other, false);
      toast(e instanceof Error ? e.message : 'The check did not start.', 'error');
    }
  }

  private async trash(): Promise<void> {
    const paths = [...this.picked].sort((a, b) => b.length - a.length);
    if (!paths.length) return;
    try {
      const r = await utilApi.trash(paths);
      const failed = new Set(r.errors.map((x) => x.path));
      const gone = paths.filter((p) => !failed.has(p));
      const under = (p: string): boolean => gone.some((g) => p === g || p.startsWith(`${g}/`) || p.startsWith(`${g}\\`));
      this.rows = this.rows.filter((row) => !under(row.path));
      this.picked.clear();
      toast(r.errors.length ? `Moved ${r.trashed} to the trash. ${r.errors.length} could not be moved.` : `Moved ${r.trashed} to the trash.`, r.errors.length ? 'error' : 'info');
      this.render();
      this.deps.changed();
    } catch (e) { toast(e instanceof Error ? e.message : 'Nothing was moved.', 'error'); }
  }

  private syncButtons(): void {
    const trash = q<HTMLButtonElement>(this.root, '[data-cu="trash"]');
    setDisabled(trash, this.picked.size === 0);
    setDisabled(q<HTMLButtonElement>(this.root, '[data-cu="all"]'), this.rows.length === 0);
    setText(q(this.root, '[data-cu="all"]'), this.rows.length && this.picked.size === this.rows.length ? 'Select none' : 'Select all');
    setText(q(trash, '.ft-u-btn-label'), this.picked.size ? `Move ${this.picked.size} to trash` : 'Move to trash');
  }

  private render(): void {
    setText(q(this.root, '.ft-cu-title'), this.mode === 'empty' ? 'Empty folders' : 'Broken files');
    setText(q(this.root, '.ft-cu-sum'), `${this.rows.length.toLocaleString()} found`);
    const empty = q(this.root, '.ft-cu-empty');
    setHidden(empty, this.rows.length > 0);
    setText(empty, this.mode === 'empty' ? 'No empty folders here.' : 'Every picture and media file here opened.');
    const upd = (n: HTMLElement, r: Row): void => setChecked(q<HTMLInputElement>(n, 'input'), this.picked.has(r.path));
    patchList(q(this.root, '.ft-cu-list'), this.rows.slice(0, 3000), {
      key: (r) => `${this.mode}:${r.path}`,
      create: (r) => {
        const n = el<HTMLElement>(`<label class="ft-cu-row"><input type="checkbox" class="ft-check" data-pick="${escapeHtml(r.path)}"><span class="ft-d-text"><span class="ft-d-name"></span><span class="ft-d-dir"></span></span><span class="ft-cu-note"></span><button class="cv-tt-btn" type="button" data-reveal="${escapeHtml(r.path)}" title="Show in folder" aria-label="Show in folder">${icon('folderOpen', 14)}</button></label>`);
        setText(q(n, '.ft-d-name'), baseName(r.path));
        setText(q(n, '.ft-d-dir'), r.path);
        setText(q(n, '.ft-cu-note'), r.note);
        upd(n, r);
        return n;
      },
      update: upd,
    });
    this.syncButtons();
  }
}
