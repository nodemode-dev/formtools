import { api, type Entry, type Listing, type Place } from '../io/api';
import { delayedIndicator, el, escapeHtml, patchList, q, setClass, setHidden, setText, setValue, type Disposer } from './dom';
import { icon } from './icons';
import { loadPrefs, onPrefs, updatePrefs, type Prefs } from './prefs';
import { toast } from './toast';

export interface BrowserDeps {
  openFile: (entries: Entry[], index: number) => void;
  quickLook: (entries: Entry[], index: number) => void;
  status: (text: string) => void;
  folderChanged: (path: string) => void;
}

const TYPE_ICON: Record<string, string> = {
  dir: 'folder', image: 'fileImage', video: 'ftMedia', audio: 'ftAudio', model: 'ftCube', text: 'ftText', archive: 'ftArchive', font: 'ftFont', pdf: 'ftText', family: 'ftFamily', other: 'newFile',
};
const THUMBABLE = new Set(['image', 'family']);
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}

const fmtDate = (s: number): string => new Date(s * 1000).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export class Browser {
  readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly places: HTMLElement;
  private readonly pathInput: HTMLInputElement;
  private readonly filter: HTMLInputElement;
  private readonly sort: HTMLSelectElement;
  private readonly size: HTMLInputElement;
  private readonly empty: HTMLElement;
  private readonly bar: HTMLElement;
  private listing: Listing | null = null;
  private shown: Entry[] = [];
  private selected = -1;
  private loadSeq = 0;
  private stopIndicator: Disposer | null = null;
  private readonly io: IntersectionObserver;

  constructor(private readonly deps: BrowserDeps) {
    const p = loadPrefs();
    this.root = el<HTMLElement>(`
      <section class="ft-browser ft-page" aria-label="Browser" data-page="browse" hidden>
        <aside class="ft-places" aria-label="Places"><div class="ft-places-title">Places</div><div class="ft-places-list"></div></aside>
        <div class="ft-browser-main">
          <div class="ft-bbar">
            <button class="cv-tt-btn" type="button" data-act="up" title="Enclosing folder" aria-label="Enclosing folder">${icon('ftUp', 16)}</button>
            <button class="cv-tt-btn" type="button" data-act="refresh" title="Reload" aria-label="Reload">${icon('refresh', 16)}</button>
            <input class="ft-path" type="text" spellcheck="false" autocomplete="off" aria-label="Folder path" placeholder="Type a folder path and press Enter">
            <label class="cv-hf-filter">${icon('search', 14)}<input class="cv-hf-input ft-filter" type="search" placeholder="Filter" aria-label="Filter by name"></label>
            <select class="cv-hf-sort ft-sort" aria-label="Sort by">
              <option value="name">Name</option><option value="date">Date</option><option value="size">Size</option><option value="type">Type</option>
            </select>
            <button class="cv-tt-btn ft-sortdir" type="button" data-act="sortdir" title="Reverse order" aria-label="Reverse order">${icon('swap', 16)}</button>
            <input class="ft-size" type="range" min="96" max="320" step="8" aria-label="Thumbnail size">
            <div class="cv-hf-views">
              <button class="cv-hf-view" type="button" data-view="grid" title="Grid" aria-label="Grid">${icon('viewGrid', 16)}</button>
              <button class="cv-hf-view" type="button" data-view="list" title="List" aria-label="List">${icon('viewList', 16)}</button>
            </div>
            <span class="ft-bbar-busy" aria-hidden="true"></span>
          </div>
          <div class="ft-grid" role="listbox" tabindex="0" aria-label="Files"></div>
          <p class="cv-hf-empty ft-grid-empty" hidden></p>
        </div>
      </section>`);
    this.grid = q(this.root, '.ft-grid');
    this.places = q(this.root, '.ft-places-list');
    this.pathInput = q(this.root, '.ft-path');
    this.filter = q(this.root, '.ft-filter');
    this.sort = q(this.root, '.ft-sort');
    this.size = q(this.root, '.ft-size');
    this.empty = q(this.root, '.ft-grid-empty');
    this.bar = q(this.root, '.ft-bbar');
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) this.loadThumb(e.target as HTMLElement);
    }, { root: this.grid, rootMargin: '400px 0px' });
    this.syncPrefs(p);
    onPrefs((np) => this.syncPrefs(np));
    this.wire();
  }

  private wire(): void {
    this.bar.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const act = t?.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'up') this.up();
      else if (act === 'refresh' && this.listing) void this.open(this.listing.path, true);
      else if (act === 'sortdir') updatePrefs({ sortDesc: !loadPrefs().sortDesc });
      const view = t?.closest<HTMLElement>('[data-view]')?.dataset.view;
      if (view === 'grid' || view === 'list') updatePrefs({ browserView: view });
    });
    this.pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); void this.open(this.pathInput.value.trim()); this.grid.focus(); }
      else if (e.key === 'Escape') { this.pathInput.value = this.listing?.path ?? ''; this.grid.focus(); }
    });
    this.filter.addEventListener('input', () => this.render());
    this.filter.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); this.grid.focus(); if (this.selected < 0 && this.shown.length) this.select(0); } });
    this.sort.addEventListener('change', () => updatePrefs({ sortBy: this.sort.value as Prefs['sortBy'] }));
    this.size.addEventListener('input', () => this.grid.style.setProperty('--ft-thumb', `${this.size.value}px`));
    this.size.addEventListener('change', () => updatePrefs({ thumbSize: Number(this.size.value) }));
    this.places.addEventListener('click', (e) => {
      const path = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-path]') : null)?.dataset.path;
      if (path) void this.open(path);
    });
    this.grid.addEventListener('click', (e) => {
      const item = e.target instanceof Element ? e.target.closest<HTMLElement>('.ft-item') : null;
      if (item) this.select(this.shown.findIndex((x) => x.path === item.dataset.key));
    });
    this.grid.addEventListener('dblclick', (e) => {
      const item = e.target instanceof Element ? e.target.closest<HTMLElement>('.ft-item') : null;
      if (item) this.activate(this.shown.findIndex((x) => x.path === item.dataset.key));
    });
    this.grid.addEventListener('keydown', (e) => this.key(e));
  }

  private syncPrefs(p: Prefs): void {
    setValue(this.sort, p.sortBy);
    setValue(this.size, String(p.thumbSize));
    this.grid.style.setProperty('--ft-thumb', `${p.thumbSize}px`);
    setClass(this.root, 'is-list', p.browserView === 'list');
    setClass(q(this.root, '.ft-sortdir'), 'is-on', p.sortDesc);
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-view]')) setClass(b, 'is-active', b.dataset.view === p.browserView);
    if (this.listing) this.render();
  }

  async start(): Promise<void> {
    try {
      const home = await api.home();
      this.setPlaces(home.roots);
      const last = loadPrefs().lastFolder;
      await this.open(last || home.home, false, home.home);
    } catch (e) {
      this.deps.status(e instanceof Error ? e.message : 'The engine is not answering.');
    }
  }

  private setPlaces(roots: Place[]): void {
    patchList(this.places, roots, {
      key: (r) => r.path,
      create: (r) => el<HTMLElement>(`<button class="ft-place" type="button" data-path="${escapeHtml(r.path)}" title="${escapeHtml(r.path)}">${icon('folder', 16)}<span>${escapeHtml(r.name)}</span></button>`),
      update: () => undefined,
    });
  }

  get path(): string { return this.listing?.path ?? ''; }

  async open(path: string, keepSelection = false, fallback?: string): Promise<void> {
    if (!path) return;
    const seq = ++this.loadSeq;
    this.stopIndicator?.();
    const busy = q(this.root, '.ft-bbar-busy');
    this.stopIndicator = delayedIndicator(() => setClass(busy, 'is-on', true), () => setClass(busy, 'is-on', false));
    try {
      const listing = await api.list(path, loadPrefs().showHidden);
      if (seq !== this.loadSeq) return;
      const prevPath = this.listing?.path;
      const keep = keepSelection && this.selected >= 0 ? this.shown[this.selected]?.path : (prevPath && listing.path !== prevPath && prevPath.startsWith(listing.path) ? prevPath : undefined);
      this.listing = listing;
      this.pathInput.value = listing.path;
      if (!keepSelection) { this.filter.value = ''; this.grid.scrollTop = 0; }
      this.selected = -1;
      this.render();
      if (keep) { const i = this.shown.findIndex((x) => x.path === keep); if (i >= 0) this.select(i); }
      updatePrefs({ lastFolder: listing.path });
      this.deps.folderChanged(listing.path);
    } catch (e) {
      if (seq !== this.loadSeq) return;
      if (fallback && fallback !== path) { await this.open(fallback); return; }
      toast(e instanceof Error ? e.message : `Could not open ${path}.`, 'error');
      this.pathInput.value = this.listing?.path ?? '';
    } finally {
      if (seq === this.loadSeq) { this.stopIndicator?.(); this.stopIndicator = null; }
    }
  }

  private up(): void { if (this.listing?.parent) void this.open(this.listing.parent); }

  private sorted(list: Entry[]): Entry[] {
    const p = loadPrefs();
    const dir = p.sortDesc ? -1 : 1;
    const by = (a: Entry, b: Entry): number => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      let c = 0;
      if (p.sortBy === 'date') c = a.mtime - b.mtime;
      else if (p.sortBy === 'size') c = a.size - b.size;
      else if (p.sortBy === 'type') c = collator.compare(a.ext, b.ext);
      return (c || collator.compare(a.name, b.name)) * dir;
    };
    return [...list].sort(by);
  }

  private render(): void {
    if (!this.listing) return;
    const f = this.filter.value.trim().toLowerCase();
    const prevKey = this.selected >= 0 ? this.shown[this.selected]?.path : undefined;
    this.shown = this.sorted(this.listing.entries.filter((e) => !f || e.name.toLowerCase().includes(f)));
    const update = (node: HTMLElement, e: Entry): void => {
      setText(q(node, '.ft-item-name'), e.name);
      setText(q(node, '.ft-item-meta'), e.kind === 'dir' ? 'Folder' : `${e.ext.toUpperCase() || 'File'} · ${fmtSize(e.size)}`);
      setText(q(node, '.ft-item-date'), fmtDate(e.mtime));
      const stamp = String(e.mtime);
      if (node.dataset.stamp !== stamp) {
        node.dataset.stamp = stamp;
        const img = q<HTMLImageElement>(node, '.ft-item-img');
        if (img.dataset.src) { img.dataset.src = ''; delete node.dataset.loaded; this.io.unobserve(node); if (THUMBABLE.has(e.type)) this.io.observe(node); }
      }
    };
    patchList(this.grid, this.shown, {
      key: (e) => e.path,
      create: (e) => {
        const n = el<HTMLElement>(`<div class="ft-item" role="option" aria-selected="false" data-type="${e.kind === 'dir' ? 'dir' : e.type}">
          <div class="ft-item-thumb"><span class="ft-item-glyph">${icon(TYPE_ICON[e.kind === 'dir' ? 'dir' : e.type] ?? 'newFile', 28)}</span><img class="ft-item-img" alt="" decoding="async" hidden></div>
          <span class="ft-item-name"></span><span class="ft-item-meta"></span><span class="ft-item-date"></span></div>`);
        n.dataset.stamp = String(e.mtime);
        update(n, e);
        if (e.kind === 'file' && THUMBABLE.has(e.type)) this.io.observe(n);
        return n;
      },
      update,
    });
    const msg = this.listing.entries.length === 0 ? 'This folder is empty.' : this.shown.length === 0 ? 'Nothing matches the filter.' : '';
    setText(this.empty, msg);
    setHidden(this.empty, !msg);
    const i = prevKey ? this.shown.findIndex((x) => x.path === prevKey) : -1;
    this.markSelected(i);
    this.report();
  }

  private loadThumb(node: HTMLElement): void {
    if (node.dataset.loaded) return;
    node.dataset.loaded = '1';
    this.io.unobserve(node);
    const entry = this.shown.find((x) => x.path === node.dataset.key);
    if (!entry) return;
    const img = q<HTMLImageElement>(node, '.ft-item-img');
    const src = api.thumbUrl(entry.path, 320, entry.mtime);
    img.dataset.src = src;
    const probe = new Image();
    probe.decoding = 'async';
    probe.onload = () => {
      void (probe.decode ? probe.decode().catch(() => undefined) : Promise.resolve()).then(() => {
        if (img.dataset.src !== src) return;
        img.src = src;
        img.hidden = false;
        setClass(node, 'has-thumb', true);
      });
    };
    probe.src = src;
  }

  private markSelected(i: number): void {
    const prev = this.selected >= 0 ? this.grid.querySelector<HTMLElement>(`.ft-item.is-selected`) : null;
    if (prev) { setClass(prev, 'is-selected', false); prev.setAttribute('aria-selected', 'false'); }
    this.selected = i;
    if (i < 0) return;
    const node = this.grid.children[i] as HTMLElement | undefined;
    if (!node) return;
    setClass(node, 'is-selected', true);
    node.setAttribute('aria-selected', 'true');
  }

  private select(i: number): void {
    if (i < 0 || i >= this.shown.length) return;
    this.markSelected(i);
    (this.grid.children[i] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
    this.report();
  }

  private report(): void {
    const files = this.shown.filter((e) => e.kind === 'file').length;
    const dirs = this.shown.length - files;
    const sel = this.selected >= 0 ? this.shown[this.selected] : null;
    const base = `${dirs} folder${dirs === 1 ? '' : 's'}, ${files} file${files === 1 ? '' : 's'}`;
    this.deps.status(sel ? `${base} · ${sel.name}${sel.kind === 'file' ? ` · ${fmtSize(sel.size)}` : ''}` : base);
  }

  private columns(): number {
    if (this.root.classList.contains('is-list') || this.grid.children.length < 2) return 1;
    const first = (this.grid.children[0] as HTMLElement).offsetTop;
    let n = 0;
    for (const c of Array.from(this.grid.children)) { if ((c as HTMLElement).offsetTop !== first) break; n++; }
    return Math.max(1, n);
  }

  private activate(i: number): void {
    const e = this.shown[i];
    if (!e) return;
    if (e.kind === 'dir') { void this.open(e.path); return; }
    const files = this.shown.filter((x) => x.kind === 'file');
    this.deps.openFile(files, files.indexOf(e));
  }

  private key(e: KeyboardEvent): void {
    const n = this.shown.length;
    if (!n && e.key !== 'Backspace') return;
    const cols = this.columns();
    const at = this.selected;
    const go = (i: number): void => { e.preventDefault(); this.select(Math.max(0, Math.min(n - 1, i))); };
    switch (e.key) {
      case 'ArrowRight': go(at < 0 ? 0 : at + 1); break;
      case 'ArrowLeft': go(at < 0 ? 0 : at - 1); break;
      case 'ArrowDown': if (e.altKey || e.metaKey) { e.preventDefault(); this.activate(at); } else go(at < 0 ? 0 : at + cols); break;
      case 'ArrowUp': if (e.altKey || e.metaKey) { e.preventDefault(); this.up(); } else go(at < 0 ? 0 : at - cols); break;
      case 'Home': go(0); break;
      case 'End': go(n - 1); break;
      case 'PageDown': go(at + cols * 4); break;
      case 'PageUp': go(at - cols * 4); break;
      case 'Enter': e.preventDefault(); this.activate(at); break;
      case 'Backspace': e.preventDefault(); this.up(); break;
      case ' ': {
        e.preventDefault();
        const sel = this.shown[at];
        if (sel?.kind === 'file') { const files = this.shown.filter((x) => x.kind === 'file'); this.deps.quickLook(files, files.indexOf(sel)); }
        break;
      }
      default: break;
    }
  }

  focus(): void { this.grid.focus({ preventScroll: true }); }

  selectPath(path: string): void { const i = this.shown.findIndex((x) => x.path === path); if (i >= 0) this.select(i); }

  focusPath(): void { this.pathInput.focus(); this.pathInput.select(); }
}
