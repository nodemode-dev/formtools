import { api, type Job } from '../../io/api';
import { baseName, dirName, fmtBytes, utilApi, type DupeFile, type DupeGroup, type DupesResult } from '../../io/util-api';
import { el, escapeHtml, patchList, q, setChecked, setClass, setDisabled, setHidden, setText } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import { InputList } from '../tools/inputs';
import { confirmButton, progressText, RunButton, track, type UtilDeps } from './common';

const PICTURE = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif)$/i;
const SHOWN = 400;

export class DupesView {
  readonly root = el<HTMLElement>(`<div class="ft-util-view" data-util="dupes" hidden>
      <div class="ft-util-side">
        <div class="ft-inputs-slot"></div>
        <section class="ft-panel">
          <header class="ft-panel-head"><span class="ft-panel-title">Find</span></header>
          <label class="ft-row"><span class="ft-row-label">Match</span><select class="cv-hf-sort" data-d="mode"><option value="exact">Identical content</option><option value="similar-images">Similar pictures</option></select></label>
          <label class="ft-row ft-d-thr is-off"><span class="ft-row-label">Closeness</span><span class="ft-range"><input type="range" min="0" max="16" value="6" data-d="threshold" disabled><output class="ft-range-out">6</output></span></label>
          <label class="ft-row"><span class="ft-row-label">Smallest file</span><select class="cv-hf-sort" data-d="min"><option value="1">Any size</option><option value="1024">1 KB</option><option value="102400">100 KB</option><option value="1048576">1 MB</option><option value="10485760">10 MB</option></select></label>
          <label class="ft-row"><span class="ft-row-label">Include hidden files</span><input type="checkbox" class="ft-check" data-d="hidden"></label>
          <p class="ft-note">Identical content compares sizes, then a quick hash of each end, then a full BLAKE3 hash. Similar pictures compares a small fingerprint of each picture.</p>
        </section>
        <div class="ft-run-bar"><span class="ft-run-state"></span><button class="ft-btn is-primary" type="button" data-u="run" data-mode="run">${icon('ftScan', 14)} <span class="ft-u-run-label">Find duplicates</span></button></div>
      </div>
      <div class="ft-util-main">
        <section class="ft-panel ft-util-results">
          <header class="ft-panel-head"><span class="ft-panel-title">Duplicates</span><span class="ft-panel-count ft-d-sum"></span>
            <select class="cv-hf-sort ft-d-keep" aria-label="Select copies"><option value="">Select copies...</option><option value="newest">Keep the newest in each group</option><option value="oldest">Keep the oldest in each group</option><option value="shortest">Keep the shortest path</option><option value="none">Clear the selection</option></select>
            <button class="ft-btn" type="button" data-d="trash" disabled>${icon('ftTrash', 14)} <span class="ft-u-btn-label">Move to trash</span></button>
          </header>
          <p class="ft-note ft-d-empty">Choose folders on the left and press Find duplicates. Nothing is moved until you choose files and confirm.</p>
          <div class="ft-d-groups"></div>
          <p class="ft-note ft-d-more" hidden></p>
        </section>
      </div>
    </div>`);
  readonly inputs: InputList;
  private groups: DupeGroup[] = [];
  private readonly picked = new Set<string>();
  private readonly run: RunButton;
  private readonly list = q(this.root, '.ft-d-groups');

  constructor(private readonly deps: UtilDeps) {
    this.inputs = new InputList(deps.folders);
    q(this.root, '.ft-inputs-slot').replaceWith(this.inputs.root);
    setChecked(q<HTMLInputElement>(this.inputs.root, '.ft-inputs-recursive'), true);
    this.run = new RunButton(this.root, 'Find duplicates', (id) => void api.cancelJob(id).catch(() => undefined));
    const mode = q<HTMLSelectElement>(this.root, '[data-d="mode"]');
    const thr = q<HTMLInputElement>(this.root, '[data-d="threshold"]');
    mode.addEventListener('change', () => {
      const off = mode.value !== 'similar-images';
      setDisabled(thr, off);
      setClass(q(this.root, '.ft-d-thr'), 'is-off', off);
    });
    thr.addEventListener('input', () => setText(q(this.root, '.ft-d-thr output'), thr.value));
    q(this.root, '[data-u="run"]').addEventListener('click', () => { if (this.run.busy) this.run.stop(); else void this.scan(); });
    const keep = q<HTMLSelectElement>(this.root, '.ft-d-keep');
    keep.addEventListener('change', () => { this.autoSelect(keep.value); keep.value = ''; });
    confirmButton(q<HTMLButtonElement>(this.root, '[data-d="trash"]'), () => `Move ${this.picked.size} to the trash?`, () => void this.trash());
    this.list.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !t.dataset.pick) return;
      if (t.checked) this.picked.add(t.dataset.pick); else this.picked.delete(t.dataset.pick);
      this.syncPicked();
    });
    this.list.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const rev = t?.closest<HTMLElement>('[data-reveal]')?.dataset.reveal;
      if (rev) { this.deps.reveal(rev); return; }
      const open = t?.closest<HTMLElement>('[data-open]')?.dataset.open;
      if (open) this.deps.open(open);
    });
  }

  show(inputs?: string[]): void { if (inputs?.length) this.inputs.set(inputs); }

  private async scan(): Promise<void> {
    if (!this.inputs.value.length) { toast('Add a folder first.', 'error'); return; }
    const val = (k: string): string => q<HTMLInputElement | HTMLSelectElement>(this.root, `[data-d="${k}"]`).value;
    const state = q(this.root, '.ft-run-state');
    let job: Job;
    try {
      job = await utilApi.dupes({
        roots: this.inputs.value, recursive: this.inputs.recursive, min_size: Number(val('min')),
        mode: val('mode') as 'exact' | 'similar-images', threshold: Number(val('threshold')),
        include_hidden: q<HTMLInputElement>(this.root, '[data-d="hidden"]').checked,
      });
    } catch (e) { toast(e instanceof Error ? e.message : 'The scan did not start.', 'error'); return; }
    this.run.start(job);
    const end = await track(this.deps.jobs, job, (j) => setText(state, progressText(j, 'files')));
    this.run.finish();
    if (end.state !== 'done') return;
    const r = end.result as DupesResult;
    this.groups = r.groups;
    this.picked.clear();
    setText(state, `${r.scanned.toLocaleString()} files looked at`);
    this.render();
  }

  private autoSelect(how: string): void {
    this.picked.clear();
    if (how !== 'none') {
      for (const g of this.groups) {
        const files = [...g.files];
        files.sort((a, b) => how === 'newest' ? b.mtime - a.mtime : how === 'oldest' ? a.mtime - b.mtime : a.path.length - b.path.length || a.path.localeCompare(b.path));
        for (const f of files.slice(1)) this.picked.add(f.path);
      }
    }
    this.render();
  }

  private async trash(): Promise<void> {
    const paths = [...this.picked];
    if (!paths.length) return;
    try {
      const r = await utilApi.trash(paths);
      const failed = new Set(r.errors.map((x) => x.path));
      const gone = new Set(paths.filter((p) => !failed.has(p)));
      this.groups = this.groups.map((g) => ({ ...g, files: g.files.filter((f) => !gone.has(f.path)) })).filter((g) => g.files.length > 1);
      for (const p of gone) this.picked.delete(p);
      toast(r.errors.length ? `Moved ${r.trashed} to the trash. ${r.errors.length} could not be moved.` : `Moved ${r.trashed} to the trash.`, r.errors.length ? 'error' : 'info');
      this.render();
      this.deps.changed();
    } catch (e) { toast(e instanceof Error ? e.message : 'Nothing was moved.', 'error'); }
  }

  private syncPicked(): void {
    const btn = q<HTMLButtonElement>(this.root, '[data-d="trash"]');
    setDisabled(btn, this.picked.size === 0);
    let bytes = 0;
    for (const g of this.groups) for (const f of g.files) if (this.picked.has(f.path)) bytes += f.size;
    setText(q(btn, '.ft-u-btn-label'), this.picked.size ? `Move ${this.picked.size} to trash (${fmtBytes(bytes)})` : 'Move to trash');
  }

  private render(): void {
    const wasted = this.groups.reduce((s, g) => s + g.size * (g.files.length - 1), 0);
    setText(q(this.root, '.ft-d-sum'), this.groups.length ? `${this.groups.length.toLocaleString()} groups · ${fmtBytes(wasted)} in extra copies` : '');
    const empty = q(this.root, '.ft-d-empty');
    setHidden(empty, this.groups.length > 0);
    if (!this.groups.length) setText(empty, 'No duplicates found. Choose other folders, or try Similar pictures.');
    const shown = this.groups.slice(0, SHOWN);
    const more = q(this.root, '.ft-d-more');
    setHidden(more, this.groups.length <= SHOWN);
    setText(more, `Showing the ${SHOWN} groups that waste the most space of ${this.groups.length.toLocaleString()}. Clear some and scan again for the rest.`);
    patchList(this.list, shown, {
      key: (g) => g.key,
      create: (g) => {
        const n = el<HTMLElement>(`<div class="ft-d-group"><div class="ft-d-ghead"><span class="ft-d-gsize"></span><span class="ft-d-gcount"></span></div><div class="ft-d-files"></div></div>`);
        this.updateGroup(n, g);
        return n;
      },
      update: (n, g) => this.updateGroup(n, g),
    });
    this.syncPicked();
  }

  private updateGroup(n: HTMLElement, g: DupeGroup): void {
    setText(q(n, '.ft-d-gsize'), fmtBytes(g.size));
    setText(q(n, '.ft-d-gcount'), `${g.files.length} copies`);
    const upd = (r: HTMLElement, f: DupeFile): void => {
      setChecked(q<HTMLInputElement>(r, 'input'), this.picked.has(f.path));
      const dims = f.width && f.height ? ` · ${f.width} x ${f.height}` : '';
      setText(q(r, '.ft-d-meta'), `${fmtBytes(f.size)}${dims} · ${new Date(f.mtime * 1000).toLocaleString()}`);
    };
    patchList(q(n, '.ft-d-files'), g.files, {
      key: (f) => f.path,
      create: (f) => {
        const pic = PICTURE.test(f.path);
        const r = el<HTMLElement>(`<label class="ft-d-file">
            <input type="checkbox" class="ft-check" data-pick="${escapeHtml(f.path)}">
            <span class="ft-d-thumb">${pic ? `<img alt="" loading="lazy" decoding="async" src="${escapeHtml(api.thumbUrl(f.path, 96, f.mtime))}">` : icon('newFile', 18)}</span>
            <span class="ft-d-text"><span class="ft-d-name"></span><span class="ft-d-dir"></span><span class="ft-d-meta"></span></span>
            <button class="cv-tt-btn" type="button" data-open="${escapeHtml(f.path)}" title="Open" aria-label="Open">${icon('ftViewer', 14)}</button>
            <button class="cv-tt-btn" type="button" data-reveal="${escapeHtml(f.path)}" title="Show in folder" aria-label="Show in folder">${icon('folderOpen', 14)}</button>
          </label>`);
        setText(q(r, '.ft-d-name'), baseName(f.path));
        setText(q(r, '.ft-d-dir'), dirName(f.path));
        r.title = f.path;
        upd(r, f);
        return r;
      },
      update: upd,
    });
  }
}
