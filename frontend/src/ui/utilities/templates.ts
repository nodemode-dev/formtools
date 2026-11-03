import { utilApi, type Holder, type Template } from '../../io/util-api';
import { el, escapeHtml, patchList, q, setClass, setHidden, setText, setValue } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import type { UtilDeps } from './common';

export class TemplatesView {
  readonly root = el<HTMLElement>(`<div class="ft-util-view ft-tp" data-util="templates" hidden>
      <section class="ft-panel">
        <header class="ft-panel-head"><span class="ft-panel-title">New from template</span><span class="ft-panel-count ft-tp-count"></span>
          <button class="cv-tt-btn" type="button" data-tp="refresh" title="Reload the templates" aria-label="Reload the templates">${icon('refresh', 14)}</button>
          <button class="ft-btn" type="button" data-tp="folder">${icon('folderOpen', 14)} Show the templates folder</button></header>
        <label class="ft-row"><span class="ft-row-label">Create in</span><input type="text" class="ft-input ft-input-wide ft-tp-dest" spellcheck="false" placeholder="Folder"></label>
        <label class="ft-row"><span class="ft-row-label">Name</span><input type="text" class="ft-input ft-input-wide ft-tp-name" spellcheck="false" placeholder="Same as the template"></label>
        <div class="ft-tp-grid" role="list"></div>
        <p class="ft-note ft-tp-note">Any file or folder you put in the templates folder appears here. A new copy never replaces a file that is already there.</p>
      </section>
    </div>`);
  private folder = '';
  private loaded = false;

  constructor(private readonly deps: UtilDeps) {
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const act = t?.closest<HTMLElement>('[data-tp]')?.dataset.tp;
      if (act === 'refresh') { void this.load(); return; }
      if (act === 'folder') { if (this.folder) this.deps.reveal(this.folder); return; }
      const tpl = t?.closest<HTMLElement>('[data-template]')?.dataset.template;
      if (tpl) void this.create(tpl);
    });
  }

  show(inputs?: string[]): void {
    const dest = q<HTMLInputElement>(this.root, '.ft-tp-dest');
    if (!dest.value) setValue(dest, inputs?.[0] ?? this.deps.folder());
    if (!this.loaded) void this.load();
  }

  private async load(): Promise<void> {
    try {
      const r = await utilApi.templates();
      this.loaded = true;
      this.folder = r.folder;
      setText(q(this.root, '.ft-tp-count'), `${r.templates.length}`);
      patchList(q(this.root, '.ft-tp-grid'), r.templates, {
        key: (t) => t.path,
        create: (t: Template) => {
          const n = el<HTMLElement>(`<button type="button" class="ft-tp-item" role="listitem" data-template="${escapeHtml(t.name)}">${icon(t.kind === 'folder' ? 'folder' : 'ftTemplate', 22)}<span class="ft-tp-name"></span></button>`);
          setText(q(n, '.ft-tp-name'), t.name);
          n.title = `Create ${t.name}`;
          return n;
        },
        update: () => undefined,
      });
    } catch (e) { toast(e instanceof Error ? e.message : 'The templates did not load.', 'error'); }
  }

  private async create(template: string): Promise<void> {
    const folder = q<HTMLInputElement>(this.root, '.ft-tp-dest').value.trim();
    if (!folder) { toast('Type the folder to create it in.', 'error'); return; }
    const name = q<HTMLInputElement>(this.root, '.ft-tp-name').value.trim();
    try {
      const r = await utilApi.templateCreate(template, folder, name || undefined);
      toast(`Created ${r.path}.`);
      this.deps.changed();
    } catch (e) { toast(e instanceof Error ? e.message : 'Nothing was created.', 'error'); }
  }
}

export class LocksView {
  readonly root = el<HTMLElement>(`<div class="ft-util-view ft-lk" data-util="locks" hidden>
      <section class="ft-panel">
        <header class="ft-panel-head"><span class="ft-panel-title">Who has this file open</span></header>
        <div class="ft-lk-bar">
          <input type="text" class="ft-input ft-lk-path" spellcheck="false" placeholder="File or folder path" aria-label="File or folder path">
          <button class="ft-btn" type="button" data-lk="sel">Use the selection</button>
          <button class="ft-btn is-primary" type="button" data-lk="check">${icon('ftLocked', 14)} Check</button>
        </div>
        <p class="ft-note ft-lk-out">When a file will not delete, move or rename, a program usually still has it open. formtools lists those programs; close them in their own windows.</p>
        <div class="ft-lk-list" role="list"></div>
      </section>
    </div>`);

  constructor(private readonly deps: UtilDeps) {
    const path = q<HTMLInputElement>(this.root, '.ft-lk-path');
    path.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void this.check(); } });
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const act = t?.closest<HTMLElement>('[data-lk]')?.dataset.lk;
      if (act === 'sel') { const s = this.deps.selection()[0]; if (s) path.value = s; }
      else if (act === 'check') void this.check();
    });
  }

  show(inputs?: string[]): void {
    const p = q<HTMLInputElement>(this.root, '.ft-lk-path');
    if (inputs?.[0]) setValue(p, inputs[0]);
  }

  private async check(): Promise<void> {
    const path = q<HTMLInputElement>(this.root, '.ft-lk-path').value.trim();
    if (!path) { toast('Type a path first.', 'error'); return; }
    const out = q(this.root, '.ft-lk-out');
    try {
      const r = await utilApi.locks(path);
      setClass(out, 'is-bad', r.holders.length > 0);
      setText(out, !r.supported ? 'This system does not let formtools see which programs hold files open.' : r.holders.length ? `${r.holders.length} ${r.holders.length === 1 ? 'program has' : 'programs have'} it open.` : 'No program has it open right now.');
      patchList(q(this.root, '.ft-lk-list'), r.holders, {
        key: (h: Holder) => String(h.pid),
        create: (h) => { const n = el<HTMLElement>(`<div class="ft-lk-item" role="listitem"><span class="ft-lk-name"></span><span class="ft-lk-meta"></span></div>`); setText(q(n, '.ft-lk-name'), h.name); setText(q(n, '.ft-lk-meta'), `Process ${h.pid}${h.user ? ` · ${h.user}` : ''}`); return n; },
        update: (n, h) => { setText(q(n, '.ft-lk-name'), h.name); },
      });
      setHidden(q(this.root, '.ft-lk-list'), r.holders.length === 0);
    } catch (e) { toast(e instanceof Error ? e.message : 'The check failed.', 'error'); }
  }
}
